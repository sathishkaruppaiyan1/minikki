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

    // First fetch the product to get its images for the ID-to-URL map
    const productUrl = `${storeUrl}/wp-json/wc/v3/products/${productId}`;
    console.log(`Fetching product from: ${productUrl}`);

    const productResponse = await fetch(productUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!productResponse.ok) {
      throw new Error(`Failed to fetch product: ${productResponse.status}`);
    }

    const product = await productResponse.json();

    // Build image ID to URL map from product images AND variation images
    const imageIdToUrl: Record<string, string> = {};
    
    // Add product images
    product.images?.forEach((img: any) => {
      if (img.id && img.src) {
        imageIdToUrl[img.id.toString()] = img.src;
      }
    });
    
    console.log(`Built initial image ID map with ${Object.keys(imageIdToUrl).length} product images`);

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
    
    if (variations.length === 0) {
      console.log('No variations found for product', productId);
      return new Response(
        JSON.stringify({ variationGallery: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Add variation images to the map BEFORE processing gallery images
    variations.forEach((variation: any) => {
      if (variation.image?.id && variation.image?.src) {
        imageIdToUrl[variation.image.id.toString()] = variation.image.src;
      }
    });
    console.log(`Updated image ID map with variation images: ${Object.keys(imageIdToUrl).length} total images`);
    
    // Log first variation structure for debugging
    console.log('Sample variation structure:', JSON.stringify({
      id: variations[0]?.id,
      image: variations[0]?.image,
      attributes: variations[0]?.attributes,
      meta_data_count: variations[0]?.meta_data?.length || 0,
      meta_data_keys: variations[0]?.meta_data?.map((m: any) => m.key) || [],
    }, null, 2));

    // Helper to extract gallery image IDs from meta_data
    const extractGalleryImageIds = (metaData: any[]): string[] => {
      if (!metaData || metaData.length === 0) return [];

      // Extended list of meta keys used by various WooCommerce variation gallery plugins
      const possibleKeys = [
        'wpcvi_images',
        '_woo_variation_gallery_images',
        'woo_variation_gallery_images',
        '_wc_additional_variation_images',
        'wc_additional_variation_images',
        '_product_image_gallery',
        'variation_image_gallery',
        '_variation_images',
        'variation_images',
        '_thumbnail_id', // Sometimes stores gallery as array
        'gallery_images',
        '_gallery_images',
        'product_image_gallery',
        'woodmart_variation_gallery_data', // Woodmart theme
        '_woodmart_variation_gallery', // Woodmart theme
        'rtwpvg_images', // Variation Images Gallery plugin
        '_rtwpvg_images',
        'wvg_gallery_images', // WooCommerce Variation Gallery
        '_wvg_gallery_images',
      ];

      const allIds: string[] = [];

      for (const key of possibleKeys) {
        const meta = metaData.find((m: any) => m.key === key);
        if (meta?.value !== undefined && meta?.value !== null && meta?.value !== '') {
          const value = meta.value;
          let ids: string[] = [];

          if (typeof value === 'string') {
            const trimmedValue = value.trim();
            if (!trimmedValue) continue;
            
            try {
              const parsed = JSON.parse(trimmedValue);
              if (Array.isArray(parsed)) {
                ids = parsed.map((id: any) => String(id).trim()).filter((id: string) => id && !isNaN(Number(id)));
              } else if (typeof parsed === 'number') {
                ids = [String(parsed)];
              } else if (typeof parsed === 'object' && parsed !== null) {
                // Some plugins store as object with numeric keys or nested structure
                const extractIds = (obj: any): string[] => {
                  const result: string[] = [];
                  if (Array.isArray(obj)) {
                    return obj.map((id: any) => String(id).trim()).filter((id: string) => id && !isNaN(Number(id)));
                  }
                  for (const val of Object.values(obj)) {
                    if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
                      result.push(String(val).trim());
                    } else if (typeof val === 'object' && val !== null) {
                      result.push(...extractIds(val));
                    }
                  }
                  return result;
                };
                ids = extractIds(parsed);
              }
            } catch {
              // Not JSON, treat as comma-separated or single value
              if (trimmedValue.includes(',')) {
                ids = trimmedValue.split(',').map((id: string) => id.trim()).filter((id: string) => id && !isNaN(Number(id)));
              } else if (!isNaN(Number(trimmedValue))) {
                ids = [trimmedValue];
              }
            }
          } else if (Array.isArray(value)) {
            ids = value.map((id: any) => String(id).trim()).filter((id: string) => id && !isNaN(Number(id)));
          } else if (typeof value === 'number') {
            ids = [String(value)];
          } else if (typeof value === 'object' && value !== null) {
            // Handle object format - extract all numeric values
            const extractIds = (obj: any): string[] => {
              const result: string[] = [];
              if (Array.isArray(obj)) {
                return obj.map((id: any) => String(id).trim()).filter((id: string) => id && !isNaN(Number(id)));
              }
              for (const val of Object.values(obj)) {
                if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)))) {
                  result.push(String(val).trim());
                } else if (typeof val === 'object' && val !== null) {
                  result.push(...extractIds(val));
                }
              }
              return result;
            };
            ids = extractIds(value);
          }

          if (ids.length > 0) {
            console.log(`Found gallery images for key ${key}:`, ids);
            allIds.push(...ids);
          }
        }
      }

      // Return unique IDs, filtered to ensure they're valid numbers
      const uniqueIds = [...new Set(allIds)].filter((id) => {
        const numId = Number(id);
        return id && !isNaN(numId) && numId > 0;
      });
      
      return uniqueIds;
    };

    // Helper to resolve media URL by ID - uses images map first, then fallback to API
    const resolveImageUrl = async (mediaId: string): Promise<string | null> => {
      // Normalize media ID
      const normalizedId = String(mediaId).trim();
      if (!normalizedId || isNaN(Number(normalizedId))) {
        console.log(`Invalid media ID: ${mediaId}`);
        return null;
      }

      // First check if it's in the images map (includes product + variation images)
      if (imageIdToUrl[normalizedId]) {
        console.log(`Image ${normalizedId} found in images map`);
        return imageIdToUrl[normalizedId];
      }

      // Fallback to fetching from media API
      console.log(`Image ${normalizedId} not in map, trying media API`);
      try {
        const mediaUrl = `${storeUrl}/wp-json/wp/v2/media/${normalizedId}`;
        const mediaResponse = await fetch(mediaUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          const imageUrl = mediaData.source_url || mediaData.guid?.rendered || mediaData.media_details?.sizes?.full?.source_url || null;
          
          // Cache it for future use
          if (imageUrl) {
            imageIdToUrl[normalizedId] = imageUrl;
            console.log(`Image ${normalizedId} resolved from API and cached:`, imageUrl);
          }
          
          return imageUrl;
        } else {
          console.log(`Failed to fetch media ${normalizedId}: ${mediaResponse.status} ${mediaResponse.statusText}`);
        }
      } catch (err) {
        console.error(`Error fetching media ${normalizedId}:`, err);
      }
      return null;
    };

    // Group images by color
    const colorImagesMap: Record<string, string[]> = {};
    const colorVariationMap: Record<string, any[]> = {}; // Track variations per color

    for (const variation of variations) {
      // Log all attributes for debugging
      console.log(`\n=== Processing Variation ${variation.id} ===`);
      console.log('Variation attributes:', JSON.stringify(variation.attributes, null, 2));
      
      const colorAttr = variation.attributes?.find(
        (attr: any) => attr.name?.toLowerCase() === 'color' || attr.name?.toLowerCase() === 'colour'
      );
      
      // Normalize color name for consistent matching
      const colorName = colorAttr?.option ? colorAttr.option.trim() : 'Default';
      
      // If no color attribute found, try to use variation ID or other identifier
      if (!colorAttr && variation.attributes && variation.attributes.length > 0) {
        console.log(`No color attribute found. Available attributes:`, variation.attributes.map((a: any) => `${a.name}: ${a.option}`).join(', '));
      }

      console.log(`Variation ${variation.id} - Color: "${colorName}"`);
      console.log(`Variation ${variation.id} - Has main image:`, !!variation.image?.src);
      if (variation.image?.src) {
        console.log(`Variation ${variation.id} - Main image URL:`, variation.image.src);
      }
      console.log(`Variation ${variation.id} - Meta data keys:`, variation.meta_data?.map((m: any) => m.key) || []);
      
      // Log all meta_data for debugging
      if (variation.meta_data && variation.meta_data.length > 0) {
        console.log(`Variation ${variation.id} - Meta data sample:`, JSON.stringify(
          variation.meta_data.slice(0, 5).map((m: any) => ({ key: m.key, value_type: typeof m.value, value_preview: String(m.value).substring(0, 100) })),
          null, 2
        ));
      }

      if (!colorImagesMap[colorName]) {
        colorImagesMap[colorName] = [];
        colorVariationMap[colorName] = [];
      }

      // Track this variation for this color
      colorVariationMap[colorName].push(variation);

      // Add variation's main image (always add if it exists)
      if (variation.image?.src) {
        const mainImageUrl = variation.image.src;
        if (!colorImagesMap[colorName].includes(mainImageUrl)) {
          colorImagesMap[colorName].push(mainImageUrl);
          console.log(`Added main image for variation ${variation.id}, color ${colorName}:`, mainImageUrl);
        }
      }

      // Get gallery image IDs and fetch URLs
      const galleryIds = extractGalleryImageIds(variation.meta_data || []);
      console.log(`Variation ${variation.id} - Extracted ${galleryIds.length} gallery image IDs:`, galleryIds);
      
      if (galleryIds.length > 0) {
        const imagePromises = galleryIds.map((id: string) => resolveImageUrl(id));
        const fetchedUrls = await Promise.all(imagePromises);
        const validUrls = fetchedUrls.filter((url): url is string => url !== null);
        const failedUrls = galleryIds.filter((id, idx) => fetchedUrls[idx] === null);
        
        if (failedUrls.length > 0) {
          console.log(`Variation ${variation.id} - Failed to resolve ${failedUrls.length} image IDs:`, failedUrls);
        }
        
        // Add gallery images that aren't already in the list
        validUrls.forEach(url => {
          if (!colorImagesMap[colorName].includes(url)) {
            colorImagesMap[colorName].push(url);
          }
        });
        console.log(`Variation ${variation.id} - Successfully added ${validUrls.length} gallery images for color "${colorName}"`);
      } else {
        console.log(`Variation ${variation.id} - No gallery images found in meta_data`);
        if (variation.meta_data && variation.meta_data.length > 0) {
          console.log(`Variation ${variation.id} - Checking all meta_data values for potential image references...`);
          variation.meta_data.forEach((meta: any) => {
            if (meta.value && typeof meta.value === 'string' && /^\d+/.test(meta.value)) {
              console.log(`Variation ${variation.id} - Found potential image ID in meta key "${meta.key}": ${meta.value.substring(0, 50)}`);
            }
          });
        }
      }
      
      console.log(`Variation ${variation.id} - Current images for color "${colorName}": ${colorImagesMap[colorName].length} images`);
    }

    // Build result array - include all colors, even if they only have main images
    const result = Object.entries(colorImagesMap).map(([color, images]) => {
      const uniqueImages = [...new Set(images)].filter(Boolean);
      console.log(`\nColor "${color}": ${uniqueImages.length} total images from ${colorVariationMap[color]?.length || 0} variation(s)`);
      if (uniqueImages.length > 0) {
        console.log(`  Image URLs:`, uniqueImages.slice(0, 3).join(', '), uniqueImages.length > 3 ? '...' : '');
      }
      return {
        color,
        images: uniqueImages,
      };
    }).filter(item => item.images.length > 0); // Only filter out if truly no images

    console.log('\n=== FINAL RESULT ===');
    console.log(`Total colors with images: ${result.length}`);
    result.forEach(item => {
      console.log(`  - ${item.color}: ${item.images.length} images`);
    });
    console.log('Final variation gallery:', JSON.stringify(result, null, 2));

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
