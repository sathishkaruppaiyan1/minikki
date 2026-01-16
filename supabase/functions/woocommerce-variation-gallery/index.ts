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
      throw new Error('WooCommerce credentials not configured');
    }

    // Remove trailing slash to prevent double slashes in URL
    const storeUrl = storeUrlRaw.replace(/\/+$/, '');

    const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);

    const url = new URL(req.url);

    // Try query params first (for GET requests)
    let productId = url.searchParams.get('product_id');

    // If not in query params, try to get from body (for POST requests from supabase.functions.invoke)
    if (!productId) {
      try {
        const body = await req.json();
        productId = body?.product_id ? String(body.product_id) : null;
        console.log('Parsed product_id from body:', productId);
      } catch (e) {
        console.log('No JSON body or failed to parse:', e);
      }
    }

    if (!productId) {
      throw new Error('product_id is required');
    }

    console.log('Processing product_id:', productId);

    // Fetch variations for the product using authenticated WC REST API
    const variationsUrl = `${storeUrl}/wp-json/wc/v3/products/${productId}/variations?per_page=100`;
    console.log(`Fetching variations from: ${variationsUrl}`);

    const variationsResponse = await fetch(variationsUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const contentType = variationsResponse.headers.get('content-type');
    const responseText = await variationsResponse.text();

    if (!variationsResponse.ok) {
      throw new Error(`Failed to fetch variations: ${variationsResponse.status}`);
    }

    if (!contentType?.includes('application/json')) {
      console.error('WooCommerce returned non-JSON variations response', {
        status: variationsResponse.status,
        contentType,
        url: variationsResponse.url,
        preview: responseText.slice(0, 200),
      });
      throw new Error(
        `WooCommerce did not return JSON for variations (content-type: ${contentType || 'unknown'}). ` +
          `Response preview: ${responseText.slice(0, 120)}`
      );
    }

    const variations = JSON.parse(responseText);
    console.log(`Found ${variations.length} variations`);

    // Helper to extract gallery image IDs from meta_data
    const extractGalleryImageIds = (metaData: any[]): string[] => {
      if (!metaData || metaData.length === 0) return [];

      const possibleKeys = [
        'wpcvi_images',
        '_woo_variation_gallery_images',
        'woo_variation_gallery_images',
        '_wc_additional_variation_images',
        '_product_image_gallery'
      ];

      for (const key of possibleKeys) {
        const meta = metaData.find((m: any) => m.key === key);
        if (meta?.value) {
          const value = meta.value;
          let ids: string[] = [];

          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                ids = parsed.map((id: any) => id.toString());
              } else if (typeof parsed === 'number') {
                ids = [parsed.toString()];
              }
            } catch {
              if (value.includes(',')) {
                ids = value.split(',').map((id: string) => id.trim()).filter(Boolean);
              } else if (value.trim()) {
                ids = [value.trim()];
              }
            }
          } else if (Array.isArray(value)) {
            ids = value.map((id: any) => id.toString());
          } else if (typeof value === 'number') {
            ids = [value.toString()];
          }

          if (ids.length > 0) {
            console.log(`Found gallery images for key ${key}:`, ids);
            return ids.filter((id) => id && !isNaN(Number(id)));
          }
        }
      }
      return [];
    };

    // Helper to fetch media URL by ID
    const fetchMediaUrl = async (mediaId: string): Promise<string | null> => {
      try {
        const mediaUrl = `${storeUrl}/wp-json/wp/v2/media/${mediaId}`;
        const mediaResponse = await fetch(mediaUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          return mediaData.source_url || mediaData.guid?.rendered || null;
        }
      } catch (err) {
        console.error(`Error fetching media ${mediaId}:`, err);
      }
      return null;
    };

    // Group images by color
    const colorImagesMap: Record<string, string[]> = {};

    for (const variation of variations) {
      const colorAttr = variation.attributes?.find(
        (attr: any) => attr.name?.toLowerCase() === 'color' || attr.name?.toLowerCase() === 'colour'
      );
      const colorName = colorAttr?.option || 'Default';

      console.log(`Processing variation ${variation.id}, color: ${colorName}`);
      console.log(`Variation meta_data keys:`, variation.meta_data?.map((m: any) => m.key));

      if (!colorImagesMap[colorName]) {
        colorImagesMap[colorName] = [];
      }

      // Add variation's main image
      if (variation.image?.src) {
        colorImagesMap[colorName].push(variation.image.src);
      }

      // Get gallery image IDs and fetch URLs
      const galleryIds = extractGalleryImageIds(variation.meta_data || []);
      if (galleryIds.length > 0) {
        const imagePromises = galleryIds.map((id: string) => fetchMediaUrl(id));
        const fetchedUrls = await Promise.all(imagePromises);
        const validUrls = fetchedUrls.filter((url): url is string => url !== null);
        colorImagesMap[colorName].push(...validUrls);
      }
    }

    // Build result array
    const result = Object.entries(colorImagesMap).map(([color, images]) => ({
      color,
      images: [...new Set(images)].filter(Boolean),
    })).filter(item => item.images.length > 0);

    console.log('Final variation gallery:', result);

    return new Response(
      JSON.stringify({ variationGallery: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in woocommerce-variation-gallery:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
