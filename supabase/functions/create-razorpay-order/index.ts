import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const getSupabaseClient = () => {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    return createClient(url, key);
};

const getWooOrderIdFromReceipt = (receipt?: string) => {
    const match = String(receipt || "").match(/^order_(\d+)$/);
    return match ? Number(match[1]) : null;
};

const logPaymentInitiation = async (entry: {
    status: "created" | "failed";
    woocommerce_order_id: number | null;
    gateway_order_id?: string | null;
    amount?: number;
    currency?: string;
    request_payload: Record<string, unknown>;
    response_payload?: Record<string, unknown>;
    error_message?: string | null;
}) => {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn("Supabase service role not configured; payment initiation log skipped");
            return;
        }

        const { error } = await supabase.from("payment_initiation_logs").insert({
            provider: "razorpay",
            status: entry.status,
            woocommerce_order_id: entry.woocommerce_order_id,
            gateway_order_id: entry.gateway_order_id || null,
            amount: entry.amount ?? null,
            currency: entry.currency || "INR",
            request_payload: entry.request_payload,
            response_payload: entry.response_payload || {},
            error_message: entry.error_message || null,
        });

        if (error) console.error("Failed to log Razorpay payment initiation:", error);
    } catch (error) {
        console.error("Unexpected Razorpay payment log error:", error);
    }
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { amount, currency, receipt } = await req.json();
        const requestPayload = { amount, currency: currency || "INR", receipt };
        const woocommerceOrderId = getWooOrderIdFromReceipt(receipt);

        const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
        const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            console.error("Missing Razorpay credentials");
            await logPaymentInitiation({
                status: "failed",
                woocommerce_order_id: woocommerceOrderId,
                amount,
                currency: currency || "INR",
                request_payload: requestPayload,
                error_message: "Razorpay credentials not configured in Supabase secrets.",
            });
            return new Response(JSON.stringify({ error: "Razorpay credentials not configured in Supabase secrets." }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

        const response = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Razorpay expects amount in paise
                currency: currency || "INR",
                receipt: receipt,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Razorpay API error:", data);
            await logPaymentInitiation({
                status: "failed",
                woocommerce_order_id: woocommerceOrderId,
                amount,
                currency: currency || "INR",
                request_payload: requestPayload,
                response_payload: data,
                error_message: data.error?.description || "Failed to create Razorpay order",
            });
            return new Response(JSON.stringify({
                error: data.error?.description || "Failed to create Razorpay order"
            }), {
                status: response.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        await logPaymentInitiation({
            status: "created",
            woocommerce_order_id: woocommerceOrderId,
            gateway_order_id: data.id || null,
            amount,
            currency: data.currency || currency || "INR",
            request_payload: requestPayload,
            response_payload: data,
        });

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Unexpected error in Edge Function:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
