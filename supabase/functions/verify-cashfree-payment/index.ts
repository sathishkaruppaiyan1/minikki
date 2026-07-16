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
        const { cashfree_order_id, woocommerce_order_id } = await req.json();

        if (!cashfree_order_id || !woocommerce_order_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const CASHFREE_APP_ID = Deno.env.get('CASHFREE_APP_ID');
        const CASHFREE_SECRET_KEY = Deno.env.get('CASHFREE_SECRET_KEY');
        const CASHFREE_ENV = (Deno.env.get('CASHFREE_ENV') || 'sandbox').toLowerCase();

        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            return new Response(
                JSON.stringify({ error: 'Cashfree credentials not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const baseUrl = CASHFREE_ENV === 'production'
            ? 'https://api.cashfree.com'
            : 'https://sandbox.cashfree.com';
        const cfHeaders = {
            'x-api-version': API_VERSION,
            'x-client-id': CASHFREE_APP_ID,
            'x-client-secret': CASHFREE_SECRET_KEY,
        };

        // Fetch the order status from Cashfree (server-to-server, trusted)
        const orderRes = await fetch(`${baseUrl}/pg/orders/${encodeURIComponent(cashfree_order_id)}`, {
            method: 'GET',
            headers: cfHeaders,
        });

        if (!orderRes.ok) {
            const errText = await orderRes.text();
            console.error('Cashfree order fetch failed:', orderRes.status, errText.substring(0, 300));
            return new Response(
                JSON.stringify({ verified: false, payment_success: false, error: 'Could not fetch Cashfree order' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const cfOrder = await orderRes.json();
        console.log('Cashfree order status:', cfOrder.order_status, 'for', cashfree_order_id);

        // The Cashfree order must have been created FOR this WooCommerce order —
        // prevents replaying someone else's paid session against another order.
        const taggedWcId = cfOrder.order_tags?.wc_order_id;
        if (String(taggedWcId) !== String(woocommerce_order_id)) {
            console.error(`Order mismatch: Cashfree order tagged for WC ${taggedWcId}, caller claimed ${woocommerce_order_id}`);
            return new Response(
                JSON.stringify({ verified: false, payment_success: false, error: 'Order mismatch' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (cfOrder.order_status !== 'PAID') {
            return new Response(
                JSON.stringify({ verified: true, payment_success: false, status: cfOrder.order_status }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get the successful payment's id for the transaction reference
        let paymentId = '';
        let paymentMethod = '';
        try {
            const paymentsRes = await fetch(`${baseUrl}/pg/orders/${encodeURIComponent(cashfree_order_id)}/payments`, {
                method: 'GET',
                headers: cfHeaders,
            });
            if (paymentsRes.ok) {
                const payments = await paymentsRes.json();
                const success = (Array.isArray(payments) ? payments : []).find((p: any) => p.payment_status === 'SUCCESS');
                paymentId = success?.cf_payment_id ? String(success.cf_payment_id) : '';
                paymentMethod = success?.payment_group || '';
            }
        } catch (e) {
            console.warn('Could not fetch Cashfree payments:', e);
        }

        // Payment confirmed — update the WooCommerce order
        const storeUrlRaw = Deno.env.get('WOOCOMMERCE_STORE_URL');
        const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
        const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

        if (!storeUrlRaw || !consumerKey || !consumerSecret) {
            return new Response(
                JSON.stringify({ verified: true, payment_success: true, updated: false, error: 'WooCommerce credentials missing' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const storeUrl = storeUrlRaw.replace(/\/+$/, '');
        const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);

        console.log('Updating WooCommerce order:', woocommerce_order_id, 'to processing');

        const updateResponse = await fetch(
            `${storeUrl}/wp-json/wc/v3/orders/${woocommerce_order_id}`,
            {
                method: 'PUT',
                headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'processing',
                    set_paid: true,
                    transaction_id: paymentId || cashfree_order_id,
                    meta_data: [
                        { key: '_cashfree_order_id', value: cashfree_order_id },
                        { key: '_cashfree_payment_id', value: paymentId },
                        { key: '_cashfree_payment_method', value: paymentMethod },
                    ],
                }),
            }
        );

        if (!updateResponse.ok) {
            const errText = await updateResponse.text();
            console.error('WooCommerce order update failed:', updateResponse.status, errText.substring(0, 300));
            return new Response(
                JSON.stringify({ verified: true, payment_success: true, updated: false, error: 'Failed to update order status' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const updatedOrder = await updateResponse.json();
        console.log('Order updated to processing:', updatedOrder.id);

        // Send WhatsApp order confirmation via WATI (best effort)
        try {
            const whatsappMeta = updatedOrder.meta_data?.find((m: any) => m.key === 'whatsapp_number')?.value;
            const whatsappNumber = whatsappMeta || updatedOrder.billing?.phone;

            if (whatsappNumber) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL');
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
                if (supabaseUrl && supabaseKey) {
                    const watiRes = await fetch(`${supabaseUrl}/functions/v1/wati-order-notification`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                        },
                        body: JSON.stringify({
                            phoneNumber: whatsappNumber,
                            customerName: updatedOrder.billing?.first_name || 'Customer',
                            orderId: String(updatedOrder.number || updatedOrder.id),
                            amount: updatedOrder.total,
                            currency: '₹',
                        }),
                    });
                    console.log('WATI notification status:', watiRes.status);
                }
            }
        } catch (whatsappError) {
            console.error('Error sending WhatsApp notification:', whatsappError);
        }

        return new Response(
            JSON.stringify({ verified: true, payment_success: true, updated: true, order_id: updatedOrder.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('Cashfree verification error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
