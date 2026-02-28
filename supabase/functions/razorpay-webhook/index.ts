import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Razorpay Webhook Handler
// This is the safety net for orders where client-side verification failed.
// Razorpay sends webhooks for payment.captured events — we verify the signature
// and update WooCommerce order status to "processing" + mark as paid.
//
// Setup in Razorpay Dashboard:
//   Settings → Webhooks → Add New Webhook
//   URL: https://dashboard.blacklovers.in/functions/v1/razorpay-webhook
//   Secret: (use RAZORPAY_WEBHOOK_SECRET env var)
//   Events: payment.captured, payment.authorized

// HMAC-SHA256 using Web Crypto API (same as verify-razorpay-payment)
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  // Webhooks are always POST — no CORS needed (server-to-server)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Read raw body for signature verification
    const rawBody = await req.text();
    const razorpaySignature = req.headers.get("x-razorpay-signature");

    if (!razorpaySignature) {
      console.error("Missing x-razorpay-signature header");
      return new Response("Missing signature", { status: 400 });
    }

    // Verify webhook signature
    const expectedSignature = await hmacSha256Hex(RAZORPAY_WEBHOOK_SECRET, rawBody);
    if (!secureCompare(expectedSignature, razorpaySignature)) {
      console.error("Webhook signature verification FAILED");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    console.log(`Webhook received: ${eventType}`, {
      payment_id: event.payload?.payment?.entity?.id,
      order_id: event.payload?.payment?.entity?.order_id,
    });

    // Only process payment.captured and payment.authorized events
    if (eventType !== "payment.captured" && eventType !== "payment.authorized") {
      console.log(`Ignoring event type: ${eventType}`);
      return new Response(JSON.stringify({ status: "ignored", event: eventType }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment) {
      console.error("No payment entity in webhook payload");
      return new Response("Invalid payload", { status: 400 });
    }

    const razorpayPaymentId = payment.id;
    const razorpayOrderId = payment.order_id;
    const paymentStatus = payment.status; // "captured" or "authorized"
    const receiptId = payment.notes?.receipt || "";

    // Extract WooCommerce order ID from receipt (format: "order_XXXX")
    // Also check the Razorpay order's receipt field
    let wooOrderId: string | null = null;

    // Method 1: From payment notes
    if (payment.notes?.woocommerce_order_id) {
      wooOrderId = payment.notes.woocommerce_order_id;
    }

    // Method 2: From receipt field (set during create-razorpay-order as "order_XXXX")
    if (!wooOrderId && receiptId) {
      const match = receiptId.match(/^order_(\d+)$/);
      if (match) wooOrderId = match[1];
    }

    // Method 3: Fetch from Razorpay order API to get receipt
    if (!wooOrderId && razorpayOrderId) {
      try {
        const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
        const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
        if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
          const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
          const orderResp = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}`, {
            headers: { Authorization: `Basic ${auth}` },
          });
          if (orderResp.ok) {
            const orderData = await orderResp.json();
            const receipt = orderData.receipt || "";
            const match = receipt.match(/^order_(\d+)$/);
            if (match) wooOrderId = match[1];
            console.log(`Resolved WooCommerce order ID from Razorpay order receipt: ${wooOrderId}`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch Razorpay order for receipt:", err);
      }
    }

    if (!wooOrderId) {
      console.error("Could not determine WooCommerce order ID from webhook", {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        receipt: receiptId,
        notes: payment.notes,
      });
      // Return 200 so Razorpay doesn't keep retrying — we log the error for manual review
      return new Response(JSON.stringify({ status: "error", message: "Could not map to WooCommerce order" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Processing webhook for WooCommerce order ${wooOrderId}`, {
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      payment_status: paymentStatus,
    });

    // Check current WooCommerce order status before updating
    const storeUrlRaw = Deno.env.get("WOOCOMMERCE_STORE_URL");
    const consumerKey = Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");

    if (!storeUrlRaw || !consumerKey || !consumerSecret) {
      console.error("WooCommerce credentials missing");
      return new Response("WooCommerce credentials missing", { status: 500 });
    }

    const storeUrl = storeUrlRaw.replace(/\/+$/, "");
    const authHeader = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

    // Fetch current order status
    const getResponse = await fetch(
      `${storeUrl}/wp-json/wc/v3/orders/${wooOrderId}`,
      {
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      }
    );

    if (!getResponse.ok) {
      console.error(`Failed to fetch WooCommerce order ${wooOrderId}:`, getResponse.status);
      return new Response(JSON.stringify({ status: "error", message: "Failed to fetch order" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const currentOrder = await getResponse.json();
    const currentStatus = currentOrder.status;

    // Only update if order is still "pending" or "on-hold"
    // Don't overwrite "processing", "completed", "cancelled", "refunded"
    if (currentStatus !== "pending" && currentStatus !== "on-hold") {
      console.log(`Order ${wooOrderId} already has status "${currentStatus}" — skipping webhook update`);
      return new Response(
        JSON.stringify({ status: "skipped", order_id: wooOrderId, current_status: currentStatus }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update order to processing + mark as paid
    const updateResponse = await fetch(
      `${storeUrl}/wp-json/wc/v3/orders/${wooOrderId}`,
      {
        method: "PUT",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "processing",
          set_paid: true,
          transaction_id: razorpayPaymentId,
          meta_data: [
            { key: "_razorpay_payment_id", value: razorpayPaymentId },
            { key: "_razorpay_order_id", value: razorpayOrderId },
            { key: "_payment_verified_via", value: "webhook" },
          ],
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`Failed to update WooCommerce order ${wooOrderId}:`, updateResponse.status, errorText);
      // Return 500 so Razorpay retries the webhook
      return new Response("Failed to update order", { status: 500 });
    }

    const updatedOrder = await updateResponse.json();
    console.log(`Webhook: Order ${wooOrderId} updated from "${currentStatus}" to "processing"`, {
      razorpay_payment_id: razorpayPaymentId,
    });

    return new Response(
      JSON.stringify({
        status: "success",
        order_id: updatedOrder.id,
        previous_status: currentStatus,
        new_status: updatedOrder.status,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
    // Return 500 so Razorpay retries
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
