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

    // Remove trailing slash to prevent double slashes in URL
    const storeUrl = storeUrlRaw.replace(/\/+$/, '');

    const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);

    const url = new URL(req.url);
    const productId = url.searchParams.get('id');
    const categoryId = url.searchParams.get('category');
    const perPage = url.searchParams.get('per_page') || '20';
    const page = url.searchParams.get('page') || '1';
    const search = url.searchParams.get('search') || '';

    // Build WooCommerce API URL
    let apiUrl: string;

    // If fetching single product by ID
    if (productId) {
      apiUrl = `${storeUrl}/wp-json/wc/v3/products/${productId}`;
    } else {
      apiUrl = `${storeUrl}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}`;

      if (categoryId && categoryId !== 'all') {
        apiUrl += `&category=${categoryId}`;
      }

      if (search) {
        apiUrl += `&search=${encodeURIComponent(search)}`;
      }
    }

    console.log('Fetching products from:', apiUrl);

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

    const responseData = await response.json();
    const totalProducts = response.headers.get('X-WP-Total');
    const totalPages = response.headers.get('X-WP-TotalPages');

    // Helper function to fetch variations for a product
    const fetchVariations = async (productId: string): Promise<any[]> => {
      try {
        const variationsUrl = `${storeUrl}/wp-json/wc/v3/products/${productId}/variations?per_page=100`;
        console.log(`Fetching variations from: ${variationsUrl}`);
        const variationsResponse = await fetch(variationsUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (variationsResponse.ok) {
          const variations = await variationsResponse.json();
          console.log(`Found ${variations.length} variations for product ${productId}`);
          if (variations.length > 0) {
            console.log(`First variation sample:`, JSON.stringify(variations[0], null, 2));
          }
          return variations;
        } else {
          console.error(`Failed to fetch variations: ${variationsResponse.status}`);
        }
      } catch (err) {
        console.error(`Error fetching variations for product ${productId}:`, err);
      }
      return [];
    };

    // Helper function to fetch media by ID
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

    // Transform product helper function
    const transformProduct = async (product: any) => {
      // Get main product images
      const mainImages = product.images?.map((img: any) => img.src) || [];

      // Initialize variation images array
      let variationImages: { color: string; images: string[]; attributes: any[]; id: number }[] = [];
      let allVariationImageUrls: string[] = [];

      // If product is variable, fetch variations
      console.log(`Product ${product.id} type: ${product.type}, variations count: ${product.variations?.length || 0}`);

      if (product.type === 'variable') {
        const variations = await fetchVariations(product.id.toString());
        console.log(`Fetched ${variations.length} variations for product ${product.id}`);

        for (const variation of variations) {
          const colorAttr = variation.attributes?.find(
            (attr: any) => attr.name?.toLowerCase() === 'color' || attr.name?.toLowerCase() === 'colour'
          );
          const colorName = colorAttr?.option || 'Default';
          console.log(`Variation ${variation.id} color: ${colorName}`);

          // Get variation's main image
          const variationMainImage = variation.image?.src;

          // Check multiple possible meta keys for additional variation images
          const possibleMetaKeys = [
            'wpcvi_images', // Primary key from the logs
            '_woo_variation_gallery_images', // Primary key for WooCommerce variation gallery plugin
            '_wc_additional_variation_images',
            'woo_variation_gallery_images',
            'variation_image_gallery',
            '_product_image_gallery',
            'wc_additional_variation_images'
          ];

          let additionalImages: string[] = [];

          console.log(`Variation ${variation.id} available meta keys:`, variation.meta_data?.map((m: any) => m.key));

          for (const metaKey of possibleMetaKeys) {
            const additionalImagesMeta = variation.meta_data?.find(
              (meta: any) => meta.key === metaKey
            );

            if (additionalImagesMeta?.value) {
              console.log(`Found meta key ${metaKey} with value:`, additionalImagesMeta.value);

              // Handle multiple formats: JSON array, comma-separated string, single number, or array
              let imageIds: string[] = [];
              const value = additionalImagesMeta.value;

              if (typeof value === 'string') {
                // Try parsing as JSON first (handles "[123, 456]" format)
                try {
                  const parsed = JSON.parse(value);
                  if (Array.isArray(parsed)) {
                    imageIds = parsed.map((id: any) => id.toString()).filter((id: string) => id.trim());
                  } else if (typeof parsed === 'number') {
                    imageIds = [parsed.toString()];
                  }
                } catch {
                  // Not JSON, treat as comma-separated or single value
                  if (value.includes(',')) {
                    imageIds = value.split(',').map((id: string) => id.trim()).filter((id: string) => id);
                  } else if (value.trim()) {
                    imageIds = [value.trim()];
                  }
                }
              } else if (Array.isArray(value)) {
                imageIds = value.map((id: any) => id.toString()).filter((id: string) => id.trim());
              } else if (typeof value === 'number') {
                imageIds = [value.toString()];
              }

              if (imageIds.length > 0) {
                console.log(`Extracted image IDs for variation ${variation.id}:`, imageIds);
                const imagePromises = imageIds.map((id: string) => fetchMediaUrl(id.trim()));
                const fetchedImages = await Promise.all(imagePromises);
                additionalImages = fetchedImages.filter((url): url is string => url !== null);
                console.log(`Fetched ${additionalImages.length} additional images for variation ${variation.id}`);
                break; // Found images, stop checking other meta keys
              }
            }
          }

          // Combine variation images
          const variationImageList: string[] = [];
          if (variationMainImage) {
            variationImageList.push(variationMainImage);
            allVariationImageUrls.push(variationMainImage);
          }
          variationImageList.push(...additionalImages);
          allVariationImageUrls.push(...additionalImages);

          if (variationImageList.length > 0) {
            variationImages.push({
              color: colorName,
              images: variationImageList,
              attributes: variation.attributes, // Pass all attributes
              id: variation.id, // Pass variation ID
            });
          }
        }
      }

      // Also check product meta_data for additional images
      const productAdditionalImagesMeta = product.meta_data?.find(
        (meta: any) => meta.key === '_wc_additional_variation_images'
      );

      if (productAdditionalImagesMeta?.value) {
        const imageIds = productAdditionalImagesMeta.value.split(',').filter((id: string) => id.trim());
        const imagePromises = imageIds.map((id: string) => fetchMediaUrl(id.trim()));
        const fetchedImages = await Promise.all(imagePromises);
        const validImages = fetchedImages.filter((url): url is string => url !== null);
        allVariationImageUrls.push(...validImages);
      }

      // Combine all images (main + variation) removing duplicates
      const allImages = [...new Set([...mainImages, ...allVariationImageUrls])];

      return {
        id: product.id.toString(),
        name: product.name,
        slug: product.slug,
        price: parseFloat(product.price) || 0,
        originalPrice: product.regular_price ? parseFloat(product.regular_price) : undefined,
        discount: product.on_sale && product.regular_price
          ? Math.round(((parseFloat(product.regular_price) - parseFloat(product.price)) / parseFloat(product.regular_price)) * 100)
          : undefined,
        images: allImages,
        variationImages: variationImages.length > 0 ? variationImages : undefined,
        colors: product.attributes
          ?.find((attr: any) => attr.name.toLowerCase() === 'color' || attr.name.toLowerCase() === 'colour')
          ?.options || [],
        sizes: product.attributes
          ?.find((attr: any) => attr.name.toLowerCase() === 'size')
          ?.options || [],
        category: product.categories?.[0]?.name || 'Uncategorized',
        categorySlug: product.categories?.[0]?.slug || 'uncategorized',
        categoryId: product.categories?.[0]?.id?.toString() || '',
        isNew: product.featured,
        isSoldOut: product.stock_status === 'outofstock',
        description: product.description,
        shortDescription: product.short_description,
        inStock: product.stock_status === 'instock',
        sku: product.sku,
        type: product.type,
      };
    };

    // Handle single product vs multiple products
    let transformedProducts: any[];
    if (productId) {
      // Single product response (object, not array)
      const transformed = await transformProduct(responseData);
      transformedProducts = [transformed];
      console.log(`Fetched product: ${responseData.name}`);
    } else {
      // Multiple products response (array)
      transformedProducts = await Promise.all(responseData.map(transformProduct));
      console.log(`Fetched ${responseData.length} products`);
    }

    return new Response(
      JSON.stringify({
        products: transformedProducts,
        total: productId ? 1 : parseInt(totalProducts || '0'),
        totalPages: productId ? 1 : parseInt(totalPages || '1'),
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
