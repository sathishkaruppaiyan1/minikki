import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Razorpay Reconciliation
//
// Pulls EVERY payment attempt Razorpay recorded against an order
// (GET /v1/orders/{id}/payments returns failed attempts as well as the
// successful one), stores them all in payment_attempts, and repairs the
// WooCommerce order when a later attempt succeeded after an earlier failure.
//
// This is the backstop for the case neither the browser handler nor the webhook
// covered: first attempt fails → order marked failed → customer retries and
// pays → webhook missed or arrived out of order → order still reads "failed"
// even though the money is captured.
//
// Two modes (POST body):
//   { "woocommerce_order_id": 1234 }         reconcile one order
//   { "razorpay_order_id": "order_XyZ" }     reconcile one gateway order
//   { "sweep": true, "hours": 24 }           re-check every initiation in a window
//
// Auth: Bearer <SUPABASE_SERVICE_ROLE_KEY>. Never call this from the browser.
// Runs with verify_jwt = false and checks the token itself (see config.toml).

const RECOVERABLE_STATUSES = new Set(["pending", "on-hold", "failed", "cancelled"]);
const SWEEP_MAX_ORDERS = 100;

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface ReconcileResult {
  razorpay_order_id: string;
  woocommerce_order_id: number | null;
  attempts: number;
  failed_attempts: number;
  successful_payment_id: string | null;
  action: "no_payments" | "no_successful_payment" | "already_paid" | "recovered" | "unmapped" | "update_failed";
  previous_status?: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    console.error("Supabase service role not configured");
    return json({ error: "Not configured" }, 500);
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secureCompare(bearer, SERVICE_ROLE_KEY)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
  const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return json({ error: "Razorpay credentials not configured" }, 500);
  }

  const storeUrlRaw = Deno.env.get("WOOCOMMERCE_STORE_URL");
  const consumerKey = Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");
  if (!storeUrlRaw || !consumerKey || !consumerSecret) {
    return json({ error: "WooCommerce credentials not configured" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const razorpayAuth = "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const storeUrl = storeUrlRaw.replace(/\/+$/, "");
  const wooAuth = "Basic " + btoa(`${consumerKey}:${consumerSecret}`);

  const wooOrderIdFromReceipt = (receipt?: string): number | null => {
    const match = String(receipt || "").match(/^order_(\d+)$/);
    return match ? Number(match[1]) : null;
  };

  // Resolve the Razorpay order IDs to inspect, from whichever mode was requested.
  const collectTargets = async (
    body: Record<string, any>
  ): Promise<Array<{ razorpayOrderId: string; wooOrderId: number | null }>> => {
    if (body.razorpay_order_id) {
      return [{ razorpayOrderId: String(body.razorpay_order_id), wooOrderId: null }];
    }

    if (body.woocommerce_order_id) {
      const wooId = Number(body.woocommerce_order_id);
      // create-razorpay-order logged the gateway order id against this receipt.
      const { data, error } = await supabase
        .from("payment_initiation_logs")
        .select("gateway_order_id")
        .eq("provider", "razorpay")
        .eq("woocommerce_order_id", wooId)
        .not("gateway_order_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw new Error(`Lookup failed: ${error.message}`);

      const seen = new Set<string>();
      return (data || [])
        .map((row: any) => String(row.gateway_order_id))
        .filter((id: string) => (seen.has(id) ? false : (seen.add(id), true)))
        .map((id: string) => ({ razorpayOrderId: id, wooOrderId: wooId }));
    }

    if (body.sweep) {
      const hours = Math.min(Number(body.hours) || 24, 24 * 30);
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

      const { data, error } = await supabase
        .from("payment_initiation_logs")
        .select("gateway_order_id, woocommerce_order_id")
        .eq("provider", "razorpay")
        .eq("status", "created")
        .gte("created_at", since)
        .not("gateway_order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(SWEEP_MAX_ORDERS * 2);

      if (error) throw new Error(`Sweep lookup failed: ${error.message}`);

      const seen = new Set<string>();
      const targets: Array<{ razorpayOrderId: string; wooOrderId: number | null }> = [];
      for (const row of data || []) {
        const id = String((row as any).gateway_order_id);
        if (seen.has(id)) continue;
        seen.add(id);
        targets.push({
          razorpayOrderId: id,
          wooOrderId: (row as any).woocommerce_order_id ?? null,
        });
        if (targets.length >= SWEEP_MAX_ORDERS) break;
      }
      return targets;
    }

    return [];
  };

  const reconcileOne = async (
    razorpayOrderId: string,
    hintedWooOrderId: number | null
  ): Promise<ReconcileResult> => {
    // 1. Every payment attempt Razorpay has for this order, failures included.
    const paymentsResp = await fetch(
      `https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`,
      { headers: { Authorization: razorpayAuth } }
    );

    if (!paymentsResp.ok) {
      const text = await paymentsResp.text();
      throw new Error(`Razorpay payments fetch failed (${paymentsResp.status}): ${text}`);
    }

    const paymentsData = await paymentsResp.json();
    const payments: Array<Record<string, any>> = paymentsData.items || [];

    // 2. Map to the WooCommerce order via the gateway order's receipt.
    let wooOrderId = hintedWooOrderId;
    if (!wooOrderId) {
      for (const p of payments) {
        if (p.notes?.woocommerce_order_id) {
          wooOrderId = Number(p.notes.woocommerce_order_id);
          break;
        }
      }
    }
    if (!wooOrderId) {
      const orderResp = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}`, {
        headers: { Authorization: razorpayAuth },
      });
      if (orderResp.ok) {
        const orderData = await orderResp.json();
        wooOrderId = wooOrderIdFromReceipt(orderData.receipt);
      }
    }

    // 3. Persist every attempt (idempotent on the payment id).
    if (payments.length > 0) {
      const rows = payments.map((p) => ({
        provider: "razorpay",
        gateway_order_id: p.order_id || razorpayOrderId,
        gateway_payment_id: p.id,
        woocommerce_order_id: wooOrderId,
        status: p.status || "unknown",
        method: p.method || null,
        amount: typeof p.amount === "number" ? p.amount / 100 : null,
        currency: p.currency || "INR",
        customer_email: p.email || null,
        customer_phone: p.contact || null,
        error_code: p.error_code || null,
        error_description: p.error_description || null,
        error_source: p.error_source || null,
        error_step: p.error_step || null,
        error_reason: p.error_reason || null,
        recorded_via: "reconcile",
        raw_payload: p,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("payment_attempts")
        .upsert(rows, { onConflict: "provider,gateway_payment_id" });
      if (error) console.error(`Failed to store attempts for ${razorpayOrderId}:`, error);
    }

    const failedAttempts = payments.filter((p) => p.status === "failed").length;
    const successful = payments.find((p) => p.status === "captured") ||
      payments.find((p) => p.status === "authorized") || null;

    const base: ReconcileResult = {
      razorpay_order_id: razorpayOrderId,
      woocommerce_order_id: wooOrderId,
      attempts: payments.length,
      failed_attempts: failedAttempts,
      successful_payment_id: successful?.id ?? null,
      action: "no_payments",
    };

    if (payments.length === 0) return base;
    if (!successful) return { ...base, action: "no_successful_payment" };
    if (!wooOrderId) return { ...base, action: "unmapped" };

    // 4. Repair the WooCommerce order if it does not reflect the payment.
    const getResponse = await fetch(`${storeUrl}/wp-json/wc/v3/orders/${wooOrderId}`, {
      headers: { Authorization: wooAuth, "Content-Type": "application/json" },
    });
    if (!getResponse.ok) {
      return { ...base, action: "update_failed" };
    }

    const currentOrder = await getResponse.json();
    const currentStatus = currentOrder.status;

    if (!RECOVERABLE_STATUSES.has(currentStatus)) {
      return { ...base, action: "already_paid", previous_status: currentStatus };
    }

    const updateResponse = await fetch(`${storeUrl}/wp-json/wc/v3/orders/${wooOrderId}`, {
      method: "PUT",
      headers: { Authorization: wooAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "processing",
        set_paid: true,
        transaction_id: successful.id,
        meta_data: [
          { key: "_razorpay_payment_id", value: successful.id },
          { key: "_razorpay_order_id", value: razorpayOrderId },
          { key: "_payment_verified_via", value: "reconcile" },
          { key: "_payment_recovered_from", value: currentStatus },
          { key: "_razorpay_failed_attempts", value: String(failedAttempts) },
        ],
      }),
    });

    if (!updateResponse.ok) {
      const text = await updateResponse.text();
      console.error(`Reconcile: failed to update order ${wooOrderId}:`, updateResponse.status, text);
      return { ...base, action: "update_failed", previous_status: currentStatus };
    }

    console.log(
      `Reconcile: order ${wooOrderId} recovered from "${currentStatus}" using payment ${successful.id} ` +
        `(${failedAttempts} failed attempt(s) before it)`
    );
    return { ...base, action: "recovered", previous_status: currentStatus };
  };

  try {
    const body = await req.json().catch(() => ({}));
    const targets = await collectTargets(body);

    if (targets.length === 0) {
      return json(
        { error: "Provide woocommerce_order_id, razorpay_order_id, or sweep: true" },
        400
      );
    }

    const results: ReconcileResult[] = [];
    for (const target of targets) {
      try {
        results.push(await reconcileOne(target.razorpayOrderId, target.wooOrderId));
      } catch (err: any) {
        console.error(`Reconcile failed for ${target.razorpayOrderId}:`, err.message);
        results.push({
          razorpay_order_id: target.razorpayOrderId,
          woocommerce_order_id: target.wooOrderId,
          attempts: 0,
          failed_attempts: 0,
          successful_payment_id: null,
          action: "update_failed",
        });
      }
    }

    return json({
      checked: results.length,
      recovered: results.filter((r) => r.action === "recovered").length,
      results,
    });
  } catch (error: any) {
    console.error("Reconcile error:", error.message);
    return json({ error: error.message }, 500);
  }
});
