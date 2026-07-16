import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_VERSION = '2023-08-01';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const CASHFREE_APP_ID = Deno.env.get('CASHFREE_APP_ID');
        const CASHFREE_SECRET_KEY = Deno.env.get('CASHFREE_SECRET_KEY');
        const CASHFREE_ENV = (Deno.env.get('CASHFREE_ENV') || 'sandbox').toLowerCase();

        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            console.error('Cashfree credentials not configured');
            return new Response(
                JSON.stringify({ error: 'Cashfree credentials not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const baseUrl = CASHFREE_ENV === 'production'
            ? 'https://api.cashfree.com'
            : 'https://sandbox.cashfree.com';

        const { woocommerce_order_id, amount, customerName, customerEmail, customerPhone } = await req.json();

        if (!woocommerce_order_id || !amount || !customerPhone) {
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
            return new Response(
                JSON.stringify({ error: data.message || 'Failed to create Cashfree order' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('Cashfree order created:', data.order_id);

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
