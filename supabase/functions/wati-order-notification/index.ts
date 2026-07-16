import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NotificationPayload {
    phoneNumber: string;
    customerName: string;
    orderId: string;
    productImage?: string;
    amount?: string | number;
    currency?: string;
    buttonValue?: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const WATI_API_ENDPOINT = Deno.env.get('WATI_API_ENDPOINT');
        const WATI_API_KEY = Deno.env.get('WATI_API_KEY');
        const ORDER_TEMPLATE = Deno.env.get('WATI_ORDER_TEMPLATE') || 'order_cnf_as';

        if (!WATI_API_ENDPOINT || !WATI_API_KEY) {
            console.error('WATI credentials not configured');
            return new Response(
                JSON.stringify({ error: 'WATI API not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { phoneNumber, customerName, orderId, amount, currency }: NotificationPayload = await req.json();

        if (!phoneNumber || !customerName || !orderId) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: phoneNumber, customerName, orderId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Normalize to a 10-digit Indian number, then prefix country code
        const digits = phoneNumber.replace(/\D/g, '').replace(/^91/, '').slice(-10);
        if (digits.length !== 10) {
            return new Response(
                JSON.stringify({ error: 'Invalid phone number' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const currentCurrency = currency && String(currency).trim() ? String(currency).trim() : "₹";
        const currentAmount = amount !== undefined && amount !== null ? String(amount) : "0";
        const currentName = customerName && String(customerName).trim() ? String(customerName).trim() : "Customer";
        const currentOrderId = String(orderId).trim() || "Order";

        // Template body: {{1}} name, {{2}} order id, {{3}} currency, {{4}} amount
        const watiPayload = {
            template_name: ORDER_TEMPLATE,
            broadcast_name: ORDER_TEMPLATE,
            parameters: [
                { name: '1', value: currentName },
                { name: '2', value: currentOrderId },
                { name: '3', value: currentCurrency },
                { name: '4', value: currentAmount },
            ],
        };

        const watiUrl = `${WATI_API_ENDPOINT.replace(/\/+$/, '')}/api/v1/sendTemplateMessage?whatsappNumber=91${digits}`;
        const authHeader = WATI_API_KEY.startsWith('Bearer ') ? WATI_API_KEY : `Bearer ${WATI_API_KEY}`;

        console.log('Sending order notification via WATI. Order:', currentOrderId, 'template:', ORDER_TEMPLATE);

        const response = await fetch(watiUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(watiPayload),
        });

        const responseText = await response.text();
        console.log('WATI response:', response.status, responseText.substring(0, 500));

        let ok = false;
        let parsed: any = {};
        try {
            parsed = JSON.parse(responseText);
            ok = response.ok && parsed.result !== false && parsed.validWhatsAppNumber !== false;
        } catch {
            ok = false;
        }

        if (!ok) {
            return new Response(
                JSON.stringify({ error: 'Failed to send WATI notification', details: parsed.info || responseText }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Error in wati-order-notification:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
