import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        const storeUrl = storeUrlRaw.replace(/\/+$/, '');
        const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);

        const apiUrl = `${storeUrl}/wp-json/wc/v3/payment_gateways`;

        console.log('Fetching payment gateways from:', apiUrl);

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

        const allGateways = await response.json();
        console.log(`Fetched ${allGateways.length} payment gateways`);

        // Map and return only enabled gateways with relevant fields, sorted by order
        const gateways = allGateways
            .map((gw: any, index: number) => ({
                id: gw.id,
                title: gw.title,
                description: gw.description || '',
                enabled: gw.enabled,
                order: typeof gw.order === 'number' ? gw.order : index,
            }))
            .sort((a: any, b: any) => a.order - b.order);

        return new Response(
            JSON.stringify({ gateways }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in woocommerce-payment-gateways function:', errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
