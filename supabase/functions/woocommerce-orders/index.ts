import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const storeUrlRaw = Deno.env.get('WOOCOMMERCE_STORE_URL');
        const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
        const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

        if (!storeUrlRaw || !consumerKey || !consumerSecret) {
            console.error('Missing WooCommerce credentials');
            throw new Error('WooCommerce credentials not configured');
        }

        // Remove trailing slash
        const storeUrl = storeUrlRaw.replace(/\/+$/, '');
        const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);

        // GET Request: Fetch Orders by email or phone
        if (req.method === 'GET') {
            const url = new URL(req.url);
            const email = url.searchParams.get('email');
            const phone = url.searchParams.get('phone');

            if (!email && !phone) {
                return new Response(
                    JSON.stringify({ error: "Email or phone parameter is required" }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Build WooCommerce API URL to fetch orders
            // WooCommerce doesn't support direct email/phone filtering, so we fetch all and filter
            let apiUrl = `${storeUrl}/wp-json/wc/v3/orders?per_page=100&orderby=date&order=desc`;

            console.log('Fetching orders from:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('WooCommerce API error:', response.status, errorText);
                throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
            }

            const orders = await response.json();
            console.log(`Fetched ${orders.length} total orders`);

            // Filter orders by email or phone
            let filteredOrders = orders;

            if (email) {
                filteredOrders = orders.filter((order: any) => {
                    const orderEmail = order.billing?.email?.toLowerCase()?.trim();
                    const searchEmail = email.toLowerCase().trim();
                    return orderEmail === searchEmail;
                });
            }

            if (phone) {
                // Normalize phone numbers (remove +, spaces, country codes for comparison)
                const normalizePhone = (phoneStr: string) => {
                    if (!phoneStr) return '';
                    return phoneStr.replace(/\D/g, '').replace(/^91/, '').slice(-10);
                };

                const searchPhoneNormalized = normalizePhone(phone);

                filteredOrders = filteredOrders.filter((order: any) => {
                    const orderPhone = order.billing?.phone;
                    if (!orderPhone) return false;

                    const orderPhoneNormalized = normalizePhone(orderPhone);
                    return orderPhoneNormalized === searchPhoneNormalized && orderPhoneNormalized.length === 10;
                });
            }

            console.log(`Filtered to ${filteredOrders.length} matching orders`);

            return new Response(
                JSON.stringify({ orders: filteredOrders }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // POST Request: Create Order
        if (req.method === 'POST') {
            const body = await req.json();

            console.log('Received order payload:', JSON.stringify(body));

            const apiUrl = `${storeUrl}/wp-json/wc/v3/orders`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('WooCommerce API error:', response.status, errorText);
                throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
            }

            const order = await response.json();
            console.log('Order created successfully. ID:', order.id);

            return new Response(
                JSON.stringify(order),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // PUT Request: Update Order
        if (req.method === 'PUT') {
            const url = new URL(req.url);
            let orderId = url.searchParams.get('id');
            const body = await req.json();

            // Also check body for ID if not in URL
            if (!orderId && body.id) {
                orderId = body.id;
            }

            if (!orderId) {
                console.error('Update request missing Order ID');
                return new Response(
                    JSON.stringify({ error: "Order ID is required" }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            console.log(`Updating order ${orderId} with payload:`, JSON.stringify(body));

            const apiUrl = `${storeUrl}/wp-json/wc/v3/orders/${orderId}`;

            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('WooCommerce API error:', response.status, errorText);
                throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
            }

            const updatedOrder = await response.json();
            console.log('Order updated successfully. ID:', updatedOrder.id);

            return new Response(
                JSON.stringify(updatedOrder),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in woocommerce-orders function:', errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
