import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "../_runtime/serve.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=3600, s-maxage=7200',
};
// corsHeaders already carries the 1h Cache-Control above. Found pages use it; a
// miss stays uncached so a page published in WordPress appears immediately
// instead of after an hour. Previously every path used noCacheHeaders, so the
// 1h TTL was dead and every view re-hit the function.
const noCacheHeaders = { ...corsHeaders, 'Cache-Control': 'no-cache, max-age=0' };

const transformItem = (item: any) => ({
  id: item.id,
  title: item.title?.rendered || '',
  slug: item.slug,
  content: item.content?.rendered || '',
  excerpt: item.excerpt?.rendered || '',
  date: item.date,
  modified: item.modified,
  featuredImage: item.featured_media ? String(item.featured_media) : null,
});

// Fetch from WordPress REST API (pages or posts)
const fetchBySlug = async (baseUrl: string, type: 'pages' | 'posts', slug: string): Promise<any | null> => {
  const apiUrl = `${baseUrl}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(apiUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
};

serve(async (req) => {
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
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const slugsParam = url.searchParams.get('slugs');
    const id = url.searchParams.get('id');

    // 1) Multiple slugs: try each in order (pages first, then posts). Return first found.
    if (slugsParam) {
      const slugs = slugsParam.split(',').map((s) => s.trim()).filter(Boolean);
      for (const s of slugs) {
        let item = await fetchBySlug(storeUrl, 'pages', s);
        if (!item) item = await fetchBySlug(storeUrl, 'posts', s);
        if (item) {
          return new Response(JSON.stringify({ pages: [transformItem(item)] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ pages: [] }), {
        headers: { ...noCacheHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Single slug: try pages then posts
    if (slug) {
      let item = await fetchBySlug(storeUrl, 'pages', slug);
      if (!item) item = await fetchBySlug(storeUrl, 'posts', slug);
      const pages = item ? [transformItem(item)] : [];
      return new Response(JSON.stringify({ pages }), {
        headers: { ...(item ? corsHeaders : noCacheHeaders), 'Content-Type': 'application/json' },
      });
    }

    // 3) Single page by ID
    if (id) {
      const apiUrl = `${storeUrl}/wp-json/wp/v2/pages/${id}`;
      const res = await fetch(apiUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const err = await res.text();
        console.error('WordPress API error:', res.status, err);
        throw new Error(`WordPress API error: ${res.status}`);
      }
      const data = await res.json();
      return new Response(JSON.stringify({ pages: [transformItem(data)] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) All pages (legacy)
    const apiUrl = `${storeUrl}/wp-json/wp/v2/pages?per_page=100`;
    const res = await fetch(apiUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const err = await res.text();
      console.error('WordPress API error:', res.status, err);
      throw new Error(`WordPress API error: ${res.status}`);
    }
    const data = await res.json();
    const pages = (Array.isArray(data) ? data : []).map(transformItem);

    return new Response(JSON.stringify({ pages }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in woocommerce-pages:', msg);
    // Must not use corsHeaders here: it carries max-age=3600, which would let a
    // transient WordPress outage be cached as a 500 for an hour.
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...noCacheHeaders, 'Content-Type': 'application/json' },
    });
  }
});
