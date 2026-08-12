import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Returns the store's REAL tax configuration so the storefront never has to
// guess a rate. Three things matter and all three come from WooCommerce:
//
//   1. calc_taxes         — is tax enabled at all? If not, show nothing.
//   2. prices_include_tax — are catalogue prices GST-inclusive (the norm for
//                           Indian stores)? If yes the tax is *extracted* from
//                           the price, never added on top.
//   3. rates              — the actual configured rates, matched by country /
//                           state / postcode.
//
// The storefront uses this for DISPLAY only. The amount actually charged is
// whatever WooCommerce puts on the order it creates — see Checkout.tsx.

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SettingRow {
    id: string;
    value: unknown;
}

const findSetting = (rows: SettingRow[], id: string): string => {
    const row = Array.isArray(rows) ? rows.find((r) => r.id === id) : null;
    return row && row.value != null ? String(row.value) : '';
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
        const get = (path: string) =>
            fetch(`${storeUrl}/wp-json/wc/v3/${path}`, {
                method: 'GET',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            });

        const [generalRes, taxSettingsRes, ratesRes] = await Promise.all([
            get('settings/general'),
            get('settings/tax'),
            get('taxes?per_page=100&orderby=priority&order=asc'),
        ]);

        if (!ratesRes.ok) {
            const errorText = await ratesRes.text();
            console.error('WooCommerce taxes API error:', ratesRes.status, errorText);
            throw new Error(`WooCommerce API error: ${ratesRes.status} - ${errorText}`);
        }

        const general: SettingRow[] = generalRes.ok ? await generalRes.json() : [];
        const taxSettings: SettingRow[] = taxSettingsRes.ok ? await taxSettingsRes.json() : [];
        const rawRates = await ratesRes.json();

        // "yes" / "no" strings in the WooCommerce settings API
        const calcTaxes = findSetting(general, 'woocommerce_calc_taxes') === 'yes';
        const pricesIncludeTax = findSetting(taxSettings, 'woocommerce_prices_include_tax') === 'yes';
        // 'shipping' (default) | 'billing' | 'base' — which address decides the rate
        const taxBasedOn = findSetting(taxSettings, 'woocommerce_tax_based_on') || 'shipping';
        // 'incl' | 'excl' — how the cart should present prices
        const taxDisplayCart = findSetting(taxSettings, 'woocommerce_tax_display_cart') || 'excl';

        const rates = (Array.isArray(rawRates) ? rawRates : []).map((r: any) => ({
            id: r.id,
            country: (r.country || '').toUpperCase(),
            state: (r.state || '').toUpperCase(),
            postcode: r.postcode || '',
            city: r.city || '',
            // WooCommerce returns the rate as a percentage string, e.g. "5.0000"
            rate: parseFloat(r.rate) || 0,
            name: r.name || 'Tax',
            priority: Number(r.priority) || 1,
            compound: !!r.compound,
            shipping: !!r.shipping,
            class: r.class || 'standard',
            // Admin table sort order — breaks ties between equally specific rules
            order: Number(r.order) || 0,
        }));

        console.log(
            `Tax config: calc_taxes=${calcTaxes} prices_include_tax=${pricesIncludeTax} ` +
            `based_on=${taxBasedOn} rates=${rates.length}`
        );

        return new Response(
            JSON.stringify({
                calc_taxes: calcTaxes,
                prices_include_tax: pricesIncludeTax,
                tax_based_on: taxBasedOn,
                tax_display_cart: taxDisplayCart,
                rates,
            }),
            {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    // Tax config changes rarely; let the CDN carry it.
                    'Cache-Control': 'public, max-age=300, s-maxage=900',
                },
            }
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in woocommerce-taxes function:', errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
