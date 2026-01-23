import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=3600, s-maxage=7200', // Cache for 1 hour client, 2 hours CDN
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

    // Remove trailing slash to prevent double slashes in URL
    const storeUrl = storeUrlRaw.replace(/\/+$/, '');

    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const id = url.searchParams.get('id');

    let apiUrl: string;

    if (id) {
      // Fetch single page by ID
      apiUrl = `${storeUrl}/wp-json/wp/v2/pages/${id}`;
    } else if (slug) {
      // Fetch single page by slug
      apiUrl = `${storeUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`;
    } else {
      // Fetch all pages
      apiUrl = `${storeUrl}/wp-json/wp/v2/pages?per_page=100`;
    }

    console.log('Fetching pages from:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WordPress API error:', response.status, errorText);
      throw new Error(`WordPress API error: ${response.status}`);
    }

    const responseData = await response.json();

    // Transform the page data
    const transformPage = (page: any) => ({
      id: page.id,
      title: page.title?.rendered || '',
      slug: page.slug,
      content: page.content?.rendered || '',
      excerpt: page.excerpt?.rendered || '',
      date: page.date,
      modified: page.modified,
      featuredImage: page.featured_media_url || null,
    });

    let pages: any[];

    if (id) {
      // Single page response (object)
      pages = [transformPage(responseData)];
    } else if (slug) {
      // Slug search returns array
      pages = responseData.map(transformPage);
    } else {
      // All pages
      pages = responseData.map(transformPage);
    }

    return new Response(
      JSON.stringify({ pages }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in woocommerce-pages function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
