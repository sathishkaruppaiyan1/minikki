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
    const storeUrl = Deno.env.get('WOOCOMMERCE_STORE_URL');
    const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    if (!storeUrl || !consumerKey || !consumerSecret) {
      console.error('Missing WooCommerce credentials');
      throw new Error('WooCommerce credentials not configured');
    }

    const url = new URL(req.url);
    const categoryId = url.searchParams.get('category');
    const perPage = url.searchParams.get('per_page') || '20';
    const page = url.searchParams.get('page') || '1';
    const search = url.searchParams.get('search') || '';

    // Build WooCommerce API URL
    let apiUrl = `${storeUrl}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}`;
    
    if (categoryId && categoryId !== 'all') {
      apiUrl += `&category=${categoryId}`;
    }
    
    if (search) {
      apiUrl += `&search=${encodeURIComponent(search)}`;
    }

    console.log('Fetching products from:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WooCommerce API error:', response.status, errorText);
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const products = await response.json();
    const totalProducts = response.headers.get('X-WP-Total');
    const totalPages = response.headers.get('X-WP-TotalPages');

    console.log(`Fetched ${products.length} products`);

    // Transform products to match our frontend structure
    const transformedProducts = products.map((product: any) => ({
      id: product.id.toString(),
      name: product.name,
      slug: product.slug,
      price: parseFloat(product.price) || 0,
      originalPrice: product.regular_price ? parseFloat(product.regular_price) : undefined,
      discount: product.on_sale && product.regular_price 
        ? Math.round(((parseFloat(product.regular_price) - parseFloat(product.price)) / parseFloat(product.regular_price)) * 100)
        : undefined,
      images: product.images.map((img: any) => img.src),
      colors: product.attributes
        ?.find((attr: any) => attr.name.toLowerCase() === 'color')
        ?.options || [],
      sizes: product.attributes
        ?.find((attr: any) => attr.name.toLowerCase() === 'size')
        ?.options || [],
      category: product.categories?.[0]?.name || 'Uncategorized',
      categorySlug: product.categories?.[0]?.slug || 'uncategorized',
      isNew: product.featured,
      isSoldOut: product.stock_status === 'outofstock',
      description: product.description,
      shortDescription: product.short_description,
      inStock: product.stock_status === 'instock',
      sku: product.sku,
    }));

    return new Response(
      JSON.stringify({
        products: transformedProducts,
        total: parseInt(totalProducts || '0'),
        totalPages: parseInt(totalPages || '1'),
        currentPage: parseInt(page),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in woocommerce-products function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
