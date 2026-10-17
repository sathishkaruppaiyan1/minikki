import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "../_runtime/serve.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// --- Session token verification (HMAC-signed by verify-otp) ---

async function hmacHex(key: string, msg: string): Promise<string> {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
    return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

interface SessionPayload {
    phoneNumber: string;
    userId: string;
    expiresAt: number;
}

async function verifySessionToken(token: string | null, secret: string): Promise<SessionPayload | null> {
    if (!token) return null;
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = await hmacHex(secret, payloadB64);
    if (expected.length !== sig.length) return null;
    // Constant-time comparison
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;
    try {
        const payload = JSON.parse(atob(payloadB64));
        if (!payload.phoneNumber || !payload.expiresAt || payload.expiresAt < Date.now()) return null;
        return payload as SessionPayload;
    } catch {
        return null;
    }
}

const normalizePhone = (phoneStr: string) => {
    if (!phoneStr) return '';
    return phoneStr.replace(/\D/g, '').replace(/^91/, '').slice(-10);
};

// --- Payment gateway checks for order creation ---

interface EnabledGateway { id: string; title: string; }

let gatewayCache: { at: number; gateways: Map<string, EnabledGateway> } | null = null;
const GATEWAY_CACHE_MS = 5 * 60 * 1000;

async function getEnabledGateways(storeUrl: string, authHeader: string): Promise<Map<string, EnabledGateway>> {
    if (gatewayCache && Date.now() - gatewayCache.at < GATEWAY_CACHE_MS) {
        return gatewayCache.gateways;
    }
    const res = await fetch(`${storeUrl}/wp-json/wc/v3/payment_gateways`, {
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        throw new Error(`Could not load payment gateways: ${res.status}`);
    }
    const list = await res.json();
    const gateways = new Map<string, EnabledGateway>();
    for (const gw of Array.isArray(list) ? list : []) {
        if (gw?.enabled === true) gateways.set(gw.id, { id: gw.id, title: gw.title || gw.id });
    }
    gatewayCache = { at: Date.now(), gateways };
    return gateways;
}

// Online gateways start unpaid and are moved on by the payment webhook /
// verify functions. Offline ones follow WooCommerce's own defaults.
function initialStatusFor(gatewayId: string): string {
    if (gatewayId === 'cod') return 'processing';
    if (gatewayId === 'bacs' || gatewayId === 'cheque') return 'on-hold';
    return 'pending';
}

// Drop protected meta (leading underscore, e.g. _transaction_id, _paid_date).
function publicMeta(meta: unknown) {
    if (!Array.isArray(meta)) return [];
    return meta
        .filter((m: any) => m && typeof m.key === 'string' && !m.key.startsWith('_'))
        .map((m: any) => ({ key: m.key, value: m.value }));
}

// Minimal, PII-free order view for unauthenticated (guest) tracking
const sanitizeOrderForGuest = (order: any) => ({
    id: order.id,
    status: order.status,
    date_created: order.date_created,
    total: order.total,
    currency: order.currency,
    payment_method_title: order.payment_method_title,
    line_items: (Array.isArray(order.line_items) ? order.line_items : []).map((li: any) => ({
        name: li.name,
        quantity: li.quantity,
    })),
});

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const storeUrlRaw = Deno.env.get('WOOCOMMERCE_STORE_URL');
        const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
        const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');
        const sessionSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        if (!storeUrlRaw || !consumerKey || !consumerSecret) {
            console.error('Missing WooCommerce credentials');
            throw new Error('WooCommerce credentials not configured');
        }

        // Remove trailing slash
        const storeUrl = storeUrlRaw.replace(/\/+$/, '');
        const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);

        // GET Request: Fetch Orders
        if (req.method === 'GET') {
            const url = new URL(req.url);
            const email = url.searchParams.get('email');
            const phone = url.searchParams.get('phone');
            const recent = url.searchParams.get('recent');

            // Recent-orders social proof: return ONLY sanitized, non-PII-heavy fields.
            // No email, phone, address, last name, amount or order id leaves the server.
            if (recent) {
                const recentUrl = `${storeUrl}/wp-json/wc/v3/orders?per_page=40&orderby=date&order=desc`;
                const recentRes = await fetch(recentUrl, {
                    method: 'GET',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                });

                if (!recentRes.ok) {
                    const errorText = await recentRes.text();
                    console.error('WooCommerce API error (recent):', recentRes.status, errorText);
                    throw new Error(`WooCommerce API error: ${recentRes.status}`);
                }

                const rawOrders = await recentRes.json();
                const allowed = new Set(['processing', 'completed', 'on-hold']);

                const items = (Array.isArray(rawOrders) ? rawOrders : [])
                    .filter((order: any) => allowed.has(order.status))
                    .map((order: any) => {
                        const firstName = (order.billing?.first_name || '').trim().split(/\s+/)[0] || '';
                        const city = (order.billing?.city || order.shipping?.city || order.billing?.state || '').trim();
                        const li = Array.isArray(order.line_items) ? order.line_items[0] : null;
                        if (!li) return null;
                        return {
                            firstName,
                            city,
                            productName: li.name || '',
                            productImage: li.image?.src || null,
                            productId: li.product_id || null,
                            dateCreated: order.date_created_gmt || order.date_created || null,
                        };
                    })
                    .filter((x: any) => x && x.firstName && x.city && x.productName)
                    .slice(0, 20);

                return new Response(
                    JSON.stringify({ orders: items }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (!email && !phone) {
                return new Response(
                    JSON.stringify({ error: "Email or phone parameter is required" }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Identity: a valid signed session token (issued by the OTP login flow)
            // proves ownership of a phone number. Query params alone prove nothing.
            const session = await verifySessionToken(req.headers.get('x-session-token'), sessionSecret);

            // Build WooCommerce API URL to fetch orders
            // WooCommerce doesn't support direct email/phone filtering, so we fetch all and filter
            const apiUrl = `${storeUrl}/wp-json/wc/v3/orders?per_page=100&orderby=date&order=desc`;

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
                throw new Error(`WooCommerce API error: ${response.status}`);
            }

            const orders = await response.json();

            if (session) {
                // Authenticated: return full orders, but ONLY those belonging to the
                // phone number verified via OTP — never the client-supplied params.
                const verifiedPhone = normalizePhone(session.phoneNumber);
                const ownOrders = orders.filter((order: any) => {
                    const orderPhone = normalizePhone(order.billing?.phone || '');
                    return orderPhone.length === 10 && orderPhone === verifiedPhone;
                });

                console.log(`Session user ${verifiedPhone.slice(-4).padStart(10, '*')}: ${ownOrders.length} orders`);

                return new Response(
                    JSON.stringify({ orders: ownOrders }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Unauthenticated (guest order tracking): email lookup only, and the
            // response is stripped of all PII (no addresses, emails or phones).
            if (!email) {
                return new Response(
                    JSON.stringify({ error: "Login required for phone lookup" }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const searchEmail = email.toLowerCase().trim();
            const guestOrders = orders
                .filter((order: any) => order.billing?.email?.toLowerCase()?.trim() === searchEmail)
                .map(sanitizeOrderForGuest);

            return new Response(
                JSON.stringify({ orders: guestOrders }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // POST Request: Create Order
        // The client body is untrusted. Only the fields checkout needs are
        // forwarded, the payment method must be a gateway WooCommerce has
        // enabled, and status / paid state are decided here. Previously the body
        // went through verbatim, so a missing method became an unpaid "cod"
        // order created as processing even with COD disabled.
        if (req.method === 'POST') {
            const body = await req.json();

            const gateways = await getEnabledGateways(storeUrl, authHeader);
            const gateway = gateways.get(String(body.payment_method || ''));
            if (!gateway) {
                console.error(`Rejected order: payment method '${body.payment_method}' is not enabled`);
                return new Response(
                    JSON.stringify({ error: 'Selected payment method is not available. Please choose another and try again.' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
            if (lineItems.length === 0) {
                return new Response(
                    JSON.stringify({ error: 'Order has no items' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const orderData = {
                payment_method: gateway.id,
                payment_method_title: gateway.title,
                set_paid: false,
                status: initialStatusFor(gateway.id),
                billing: body.billing,
                shipping: body.shipping,
                customer_note: typeof body.customer_note === 'string' ? body.customer_note : undefined,
                line_items: lineItems.map((li: any) => ({
                    product_id: li.product_id,
                    variation_id: li.variation_id,
                    quantity: li.quantity,
                    subtotal: li.subtotal,
                    total: li.total,
                    meta_data: publicMeta(li.meta_data),
                })),
                meta_data: publicMeta(body.meta_data),
            };

            const apiUrl = `${storeUrl}/wp-json/wc/v3/orders`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
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

        // PUT Request: Update Order — requires proof of ownership via order_key
        // (unguessable, returned only to the creator at order creation), and only
        // permits the narrow set of fields the checkout flow legitimately updates.
        if (req.method === 'PUT') {
            const url = new URL(req.url);
            let orderId = url.searchParams.get('id');
            const body = await req.json();

            if (!orderId && body.id) {
                orderId = body.id;
            }

            if (!orderId) {
                return new Response(
                    JSON.stringify({ error: "Order ID is required" }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const orderKey = body.order_key;
            if (!orderKey) {
                return new Response(
                    JSON.stringify({ error: "order_key is required" }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Verify ownership: fetch the order and compare its key
            const checkRes = await fetch(`${storeUrl}/wp-json/wc/v3/orders/${orderId}`, {
                method: 'GET',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            });
            if (!checkRes.ok) {
                return new Response(
                    JSON.stringify({ error: "Order not found" }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            const existingOrder = await checkRes.json();
            if (!existingOrder.order_key || existingOrder.order_key !== orderKey) {
                console.error(`order_key mismatch for order ${orderId}`);
                return new Response(
                    JSON.stringify({ error: "Not authorized to modify this order" }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Whitelist the fields checkout is allowed to change
            const update: Record<string, unknown> = {};
            if (body.status !== undefined) {
                const allowedStatus = new Set(['cancelled', 'failed']);
                if (!allowedStatus.has(body.status)) {
                    return new Response(
                        JSON.stringify({ error: `Status change to '${body.status}' is not allowed` }),
                        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
                update.status = body.status;
            }
            if (Array.isArray(body.meta_data)) update.meta_data = publicMeta(body.meta_data);
            if (Array.isArray(body.line_items)) update.line_items = body.line_items;

            if (Object.keys(update).length === 0) {
                return new Response(
                    JSON.stringify({ error: "No permitted fields to update" }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            console.log(`Updating order ${orderId} (fields: ${Object.keys(update).join(', ')})`);

            const apiUrl = `${storeUrl}/wp-json/wc/v3/orders/${orderId}`;

            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(update)
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
