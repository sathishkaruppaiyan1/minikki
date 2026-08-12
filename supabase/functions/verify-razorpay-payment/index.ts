import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Statuses a confirmed payment is allowed to promote to "processing".
// "failed"/"cancelled" are included so a retry after a failed first attempt
// still lands the order in the right state.
const RECOVERABLE_STATUSES = new Set(["pending", "on-hold", "failed", "cancelled"]);

// Record this attempt alongside the ones the webhook captures, so the
// payment_attempts table holds the complete history for the order even when
// webhook delivery is delayed. Upsert keeps it idempotent with the webhook.
const recordSuccessfulAttempt = async (
  razorpayPaymentId: string,
  razorpayOrderId: string,
  wooOrderId: number | string
) => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.warn("Supabase service role not configured; attempt not recorded");
      return;
    }

    // Pull the authoritative payment record (method, amount, status) from Razorpay.
    let payment: Record<string, any> = { id: razorpayPaymentId, order_id: razorpayOrderId };
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
      const resp = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (resp.ok) payment = await resp.json();
    }

    const supabase = createClient(url, key);
    const { error } = await supabase.from("payment_attempts").upsert(
      {
        provider: "razorpay",
        gateway_order_id: payment.order_id || razorpayOrderId,
        gateway_payment_id: razorpayPaymentId,
        woocommerce_order_id: Number(wooOrderId),
        status: payment.status || "captured",
        method: payment.method || null,
        amount: typeof payment.amount === "number" ? payment.amount / 100 : null,
        currency: payment.currency || "INR",
        customer_email: payment.email || null,
        customer_phone: payment.contact || null,
        recorded_via: "client_verify",
        raw_payload: payment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,gateway_payment_id" }
    );

    if (error) console.error("Failed to record verified payment attempt:", error);
  } catch (error) {
    console.error("Unexpected attempt logging error:", error);
  }
};

// HMAC-SHA256 using Web Crypto API (no external dependencies)
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      woocommerce_order_id,
    } = await req.json();

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !woocommerce_order_id
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required payment verification fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_SECRET) {
      console.error("Missing RAZORPAY_KEY_SECRET");
      return new Response(
        JSON.stringify({ error: "Payment verification not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify Razorpay signature using HMAC-SHA256
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = await hmacSha256Hex(RAZORPAY_KEY_SECRET, payload);

    if (expectedSignature !== razorpay_signature) {
      console.error("Payment signature verification FAILED", {
        razorpay_order_id,
        razorpay_payment_id,
        woocommerce_order_id,
      });
      return new Response(
        JSON.stringify({ verified: false, error: "Payment signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Payment signature verified successfully", {
      razorpay_order_id,
      razorpay_payment_id,
      woocommerce_order_id,
    });

    // Signature is valid — update WooCommerce order to processing + paid
    const storeUrlRaw = Deno.env.get("WOOCOMMERCE_STORE_URL");
    const consumerKey = Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");

    if (!storeUrlRaw || !consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ verified: true, updated: false, error: "WooCommerce credentials missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storeUrl = storeUrlRaw.replace(/\/+$/, "");
    const authHeader = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

    await recordSuccessfulAttempt(razorpay_payment_id, razorpay_order_id, woocommerce_order_id);

    // Don't clobber an order the webhook (or a human) already advanced past
    // processing — but do recover one an earlier failed attempt marked failed.
    const currentResponse = await fetch(
      `${storeUrl}/wp-json/wc/v3/orders/${woocommerce_order_id}`,
      { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
    );

    if (currentResponse.ok) {
      const currentOrder = await currentResponse.json();
      if (!RECOVERABLE_STATUSES.has(currentOrder.status)) {
        console.log(
          `Order ${woocommerce_order_id} already "${currentOrder.status}" — no update needed`
        );
        return new Response(
          JSON.stringify({
            verified: true,
            updated: true,
            order_id: currentOrder.id,
            status: currentOrder.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const updateResponse = await fetch(
      `${storeUrl}/wp-json/wc/v3/orders/${woocommerce_order_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "processing",
          set_paid: true,
          transaction_id: razorpay_payment_id,
          meta_data: [
            { key: "_razorpay_payment_id", value: razorpay_payment_id },
            { key: "_razorpay_order_id", value: razorpay_order_id },
          ],
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("WooCommerce order update failed:", updateResponse.status, errorText);
      return new Response(
        JSON.stringify({ verified: true, updated: false, error: "Failed to update order status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updatedOrder = await updateResponse.json();
    console.log("Order updated to processing:", updatedOrder.id);

    return new Response(
      JSON.stringify({ verified: true, updated: true, order_id: updatedOrder.id, status: updatedOrder.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Payment verification error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
