import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_VERSION = '2023-08-01';

const getSupabaseClient = () => {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return null;
    return createClient(url, key);
};

const logPaymentInitiation = async (entry: {
    status: 'created' | 'failed';
    woocommerce_order_id: number | null;
    gateway_order_id?: string | null;
    amount?: number;
    currency?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    request_payload: Record<string, unknown>;
    response_payload?: Record<string, unknown>;
    error_message?: string | null;
}) => {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('Supabase service role not configured; payment initiation log skipped');
            return;
        }

        const { error } = await supabase.from('payment_initiation_logs').insert({
            provider: 'cashfree',
            status: entry.status,
            woocommerce_order_id: entry.woocommerce_order_id,
            gateway_order_id: entry.gateway_order_id || null,
            amount: entry.amount ?? null,
            currency: entry.currency || 'INR',
            customer_name: entry.customer_name || null,
            customer_email: entry.customer_email || null,
            customer_phone: entry.customer_phone || null,
            request_payload: entry.request_payload,
            response_payload: entry.response_payload || {},
            error_message: entry.error_message || null,
        });

        if (error) console.error('Failed to log Cashfree payment initiation:', error);
    } catch (error) {
        console.error('Unexpected Cashfree payment log error:', error);
    }
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { woocommerce_order_id, amount, customerName, customerEmail, customerPhone } = await req.json();
        const numericWooOrderId = Number(woocommerce_order_id) || null;

        const CASHFREE_APP_ID = Deno.env.get('CASHFREE_APP_ID');
        const CASHFREE_SECRET_KEY = Deno.env.get('CASHFREE_SECRET_KEY');
        const CASHFREE_ENV = (Deno.env.get('CASHFREE_ENV') || 'sandbox').toLowerCase();

        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            console.error('Cashfree credentials not configured');
            await logPaymentInitiation({
                status: 'failed',
                woocommerce_order_id: numericWooOrderId,
                amount: Number(amount) || undefined,
                currency: 'INR',
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                request_payload: {
                    woocommerce_order_id,
                    amount,
                    customerName,
                    customerEmail,
                    customerPhone,
                },
                error_message: 'Cashfree credentials not configured',
            });
            return new Response(
                JSON.stringify({ error: 'Cashfree credentials not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const baseUrl = CASHFREE_ENV === 'production'
            ? 'https://api.cashfree.com'
            : 'https://sandbox.cashfree.com';

        if (!woocommerce_order_id || !amount || !customerPhone) {
            await logPaymentInitiation({
                status: 'failed',
                woocommerce_order_id: numericWooOrderId,
                amount: Number(amount) || undefined,
                currency: 'INR',
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                request_payload: {
                    woocommerce_order_id,
                    amount,
                    customerName,
                    customerEmail,
                    customerPhone,
                },
                error_message: 'Missing required fields: woocommerce_order_id, amount, customerPhone',
            });
            return new Response(
                JSON.stringify({ error: 'Missing required fields: woocommerce_order_id, amount, customerPhone' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const phoneDigits = String(customerPhone).replace(/\D/g, '').replace(/^91/, '').slice(-10);

        // Unique Cashfree order id, tagged with the WooCommerce order it pays for.
        // verify-cashfree-payment checks this tag so a paid session can only ever
        // mark ITS OWN WooCommerce order as paid.
        const cashfreeOrderId = `wc_${woocommerce_order_id}_${Date.now()}`;

        const orderPayload = {
            order_id: cashfreeOrderId,
            order_amount: Number(amount),
            order_currency: 'INR',
            customer_details: {
                customer_id: `cust_${phoneDigits || woocommerce_order_id}`,
                customer_name: customerName || 'Customer',
                customer_email: customerEmail || 'noemail@example.com',
                customer_phone: phoneDigits || '9999999999',
            },
            order_note: `WooCommerce order ${woocommerce_order_id}`,
            order_tags: {
                wc_order_id: String(woocommerce_order_id),
            },
        };

        console.log('Creating Cashfree order:', cashfreeOrderId, 'amount:', amount, 'env:', CASHFREE_ENV);

        const response = await fetch(`${baseUrl}/pg/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-version': API_VERSION,
                'x-client-id': CASHFREE_APP_ID,
                'x-client-secret': CASHFREE_SECRET_KEY,
            },
            body: JSON.stringify(orderPayload),
        });

        const data = await response.json();

        if (!response.ok || !data.payment_session_id) {
            console.error('Cashfree order creation failed:', response.status, JSON.stringify(data).substring(0, 500));
            await logPaymentInitiation({
                status: 'failed',
                woocommerce_order_id: numericWooOrderId,
                gateway_order_id: cashfreeOrderId,
                amount: Number(amount),
                currency: 'INR',
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: phoneDigits || customerPhone,
                request_payload: orderPayload,
                response_payload: data,
                error_message: data.message || 'Failed to create Cashfree order',
            });
            return new Response(
                JSON.stringify({ error: data.message || 'Failed to create Cashfree order' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('Cashfree order created:', data.order_id);

        await logPaymentInitiation({
            status: 'created',
            woocommerce_order_id: numericWooOrderId,
            gateway_order_id: data.order_id || cashfreeOrderId,
            amount: Number(amount),
            currency: 'INR',
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: phoneDigits || customerPhone,
            request_payload: orderPayload,
            response_payload: data,
        });

        return new Response(
            JSON.stringify({
                payment_session_id: data.payment_session_id,
                cashfree_order_id: data.order_id,
                env: CASHFREE_ENV,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Error in create-cashfree-order:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
