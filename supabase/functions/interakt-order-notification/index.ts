import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface InteraktPayload {
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
        const INTERAKT_API_KEY = Deno.env.get('INTERAKT_API_KEY');

        if (!INTERAKT_API_KEY) {
            console.error('INTERAKT_API_KEY is not configured');
            return new Response(
                JSON.stringify({ error: 'Interakt API key not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { phoneNumber, customerName, orderId, productImage, amount, currency, buttonValue } = await req.json();

        if (!phoneNumber || !customerName || !orderId) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: phoneNumber, customerName, orderId' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Format phone number (remove + and ensure country code)
        const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');

        const currentCurrency = currency && String(currency).trim() ? String(currency).trim() : "₹";
        const currentAmount = amount && String(amount).trim() ? String(amount).trim() : (amount ? String(amount) : "0");
        const currentName = customerName && String(customerName).trim() ? String(customerName).trim() : "Customer";
        const currentOrderId = orderId && String(orderId).trim() ? String(orderId).trim() : "Order";

        const bValues = [
            currentName,
            currentOrderId,
            currentCurrency,
            currentAmount
        ];

        const interaktPayload: any = {
            countryCode: formattedPhone.startsWith('91') ? '+91' : '+91',
            phoneNumber: formattedPhone.startsWith('91') ? formattedPhone.slice(2) : formattedPhone,
            callbackData: `order_${currentOrderId}`,
            type: 'Template',
            template: {
                name: 'order_cnf_as',
                languageCode: 'en',
                bodyValues: bValues,
            }
        };

        console.log('Sending to Interakt. Full Payload:', JSON.stringify(interaktPayload, null, 2));

        const response = await fetch('https://api.interakt.ai/v1/public/message/', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${INTERAKT_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(interaktPayload),
        });

        const responseText = await response.text();
        console.log('Interakt Response Status:', response.status);
        console.log('Interakt Full Response Body:', responseText);

        if (!response.ok) {
            console.error('Interakt error response:', responseText);
            return new Response(
                JSON.stringify({
                    error: 'Failed to send Interakt notification',
                    details: responseText
                }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, data: JSON.parse(responseText) }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Error in interakt-order-notification:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
