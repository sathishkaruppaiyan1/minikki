import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Razorpay Webhook Handler
//
// Two jobs:
//   1. Record EVERY payment attempt (failed ones included) in payment_attempts,
//      so a customer who fails once and retries successfully leaves a full trail.
//   2. Act as the safety net when client-side verification never ran (browser
//      closed, network dropped) — promote the WooCommerce order to processing.
//
// Setup in Razorpay Dashboard → Settings → Webhooks → Add New Webhook
//   URL:    https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
//   Secret: same value as the RAZORPAY_WEBHOOK_SECRET function secret
//   Events: payment.captured, payment.authorized, payment.failed, order.paid
//
// NOTE: this function must run with verify_jwt = false (see supabase/config.toml).
// Razorpay cannot send a Supabase JWT, so JWT verification would 401 every event.

// Statuses we are willing to promote to "processing" on a confirmed payment.
// "failed" and "cancelled" are included on purpose: the first attempt may have
// marked the order failed, and the retry must still be able to recover it.
const RECOVERABLE_STATUSES = new Set(["pending", "on-hold", "failed", "cancelled"]);

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

const getSupabaseClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
};

// Upsert on (provider, gateway_payment_id) so duplicate webhook deliveries and
// an authorized→captured progression collapse into a single row.
const recordAttempt = async (
  payment: Record<string, any>,
  wooOrderId: string | null,
  recordedVia = "webhook"
) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn("Supabase service role not configured; payment attempt not recorded");
      return;
    }

    const { error } = await supabase
      .from("payment_attempts")
      .upsert(
        {
          provider: "razorpay",
          gateway_order_id: payment.order_id || null,
          gateway_payment_id: payment.id,
          woocommerce_order_id: wooOrderId ? Number(wooOrderId) : null,
          status: payment.status || "unknown",
          method: payment.method || null,
          amount: typeof payment.amount === "number" ? payment.amount / 100 : null,
          currency: payment.currency || "INR",
          customer_email: payment.email || null,
          customer_phone: payment.contact || null,
          error_code: payment.error_code || null,
          error_description: payment.error_description || null,
          error_source: payment.error_source || null,
          error_step: payment.error_step || null,
          error_reason: payment.error_reason || null,
          recorded_via: recordedVia,
          raw_payload: payment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,gateway_payment_id" }
      );

    if (error) console.error("Failed to record payment attempt:", error);
  } catch (error) {
    console.error("Unexpected payment attempt logging error:", error);
  }
};

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
      order_id: event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id,
    });

    const HANDLED_EVENTS = new Set([
      "payment.captured",
      "payment.authorized",
      "payment.failed",
      "order.paid",
    ]);

    if (!HANDLED_EVENTS.has(eventType)) {
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
    const paymentStatus = payment.status; // "captured" | "authorized" | "failed"
    const receiptId = payment.notes?.receipt || "";

    // Extract WooCommerce order ID from receipt (format: "order_XXXX")
    // Also check the Razorpay order's receipt field
    let wooOrderId: string | null = null;

    // Method 1: From payment notes
    if (payment.notes?.woocommerce_order_id) {
      wooOrderId = String(payment.notes.woocommerce_order_id);
    }

    // Method 2: From receipt field (set during create-razorpay-order as "order_XXXX")
    if (!wooOrderId && receiptId) {
      const match = String(receiptId).match(/^order_(\d+)$/);
      if (match) wooOrderId = match[1];
    }

    // Method 3: The order.paid event carries the order entity (with its receipt)
    if (!wooOrderId && event.payload?.order?.entity?.receipt) {
      const match = String(event.payload.order.entity.receipt).match(/^order_(\d+)$/);
      if (match) wooOrderId = match[1];
    }

    // Method 4: Fetch from Razorpay order API to get receipt
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

    // Record the attempt before anything else, so failed attempts and
    // unmappable payments are still visible in the database.
    await recordAttempt(payment, wooOrderId);

    if (!wooOrderId) {
      console.error("Could not determine WooCommerce order ID from webhook", {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        receipt: receiptId,
        notes: payment.notes,
      });
      // Return 200 so Razorpay doesn't keep retrying — the attempt row above
      // preserves the payment for manual reconciliation.
      return new Response(JSON.stringify({ status: "error", message: "Could not map to WooCommerce order" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // A failed attempt is recorded but never changes the WooCommerce order.
    // The customer is usually still in the Razorpay modal retrying; marking the
    // order failed here would race with the success that follows seconds later.
    if (eventType === "payment.failed" || paymentStatus === "failed") {
      console.log(`Recorded failed attempt ${razorpayPaymentId} for order ${wooOrderId}`, {
        error_code: payment.error_code,
        error_description: payment.error_description,
      });
      return new Response(
        JSON.stringify({ status: "recorded", outcome: "failed", order_id: wooOrderId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
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

    // Recover the order from pending/on-hold *and* from failed/cancelled — the
    // retry-after-failure case. Never touch processing/completed/refunded.
    if (!RECOVERABLE_STATUSES.has(currentStatus)) {
      console.log(`Order ${wooOrderId} already has status "${currentStatus}" — skipping webhook update`);
      return new Response(
        JSON.stringify({ status: "skipped", order_id: wooOrderId, current_status: currentStatus }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const recoveredFromFailure = currentStatus === "failed" || currentStatus === "cancelled";

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
            { key: "_payment_recovered_from", value: recoveredFromFailure ? currentStatus : "" },
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
      recovered_from_failure: recoveredFromFailure,
    });

    if (recoveredFromFailure) {
      // Cancelling an order restores stock in WooCommerce; moving it back to
      // processing re-reduces it. Flagged here so it is greppable in the logs.
      console.warn(`Order ${wooOrderId} recovered from "${currentStatus}" — verify stock levels`);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        order_id: updatedOrder.id,
        previous_status: currentStatus,
        new_status: updatedOrder.status,
        recovered_from_failure: recoveredFromFailure,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
    // Return 500 so Razorpay retries
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
