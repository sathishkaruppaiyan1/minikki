import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const pincode = url.searchParams.get('pincode');

        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return new Response(
                JSON.stringify({ error: 'Invalid pincode. Must be 6 digits.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Try postalpincode.in. HTTPS cert on api.postalpincode.in is expired,
        // so call the HTTP endpoint server-side (CORS doesn't apply here).
        const postalEndpoints = [
            `http://www.postalpincode.in/api/pincode/${pincode}`,
            `https://api.postalpincode.in/pincode/${pincode}`,
        ];
        for (const endpoint of postalEndpoints) {
            try {
                const res = await fetch(endpoint);
                if (res.ok) {
                    const data = await res.json();
                    // Both endpoints return [{ Status, PostOffice: [...] }]
                    const entry = Array.isArray(data) ? data[0] : data;
                    if (entry?.Status === 'Success' && entry.PostOffice?.[0]) {
                        const po = entry.PostOffice[0];
                        return new Response(
                            JSON.stringify({
                                city: po.District,
                                state: po.State,
                                country: po.Country || 'India',
                                source: endpoint,
                            }),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }
                }
            } catch (err) {
                console.warn(`postalpincode.in endpoint ${endpoint} failed:`, err);
            }
        }

        // Fallback: zippopotam.us
        try {
            const res = await fetch(`https://api.zippopotam.us/in/${pincode}`);
            if (res.ok) {
                const data = await res.json();
                const place = data?.places?.[0];
                if (place) {
                    return new Response(
                        JSON.stringify({
                            city: place['place name'],
                            state: place.state,
                            country: 'India',
                            source: 'zippopotam.us',
                        }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }
        } catch (fallbackErr) {
            console.warn('zippopotam.us failed:', fallbackErr);
        }

        return new Response(
            JSON.stringify({ error: 'Pincode not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in pincode-lookup function:', errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
