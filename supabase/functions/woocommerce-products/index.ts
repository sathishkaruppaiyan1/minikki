import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=300, s-maxage=600', // Cache for 5 min client, 10 min CDN
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
    const skipVariations = url.searchParams.get('skip_variations') === 'true'; // Skip variations for list views

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

    const contentType = response.headers.get('content-type');
    const responseText = await response.text();

    if (!response.ok) {
      console.error('WooCommerce API error:', response.status, responseText);
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    // Sometimes WooCommerce/WordPress returns an HTML login/redirect page with 200 OK.
    // In that case JSON.parse will fail with "Unexpected token '<'".
    if (!contentType?.includes('application/json')) {
      console.error('WooCommerce returned non-JSON response', {
        status: response.status,
        contentType,
        url: response.url,
        preview: responseText.slice(0, 200),
      });
      throw new Error(
        `WooCommerce did not return JSON (content-type: ${contentType || 'unknown'}). ` +
        `Check WOOCOMMERCE_STORE_URL (should be your public WordPress site, not an admin/login page) and API access. ` +
        `Response preview: ${responseText.slice(0, 120)}`
      );
    }

    const responseData = JSON.parse(responseText);
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

    // Helper function to fetch media by ID (fallback if not in product images)
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
          return mediaData.source_url || mediaData.guid?.rendered || mediaData.media_details?.sizes?.full?.source_url || null;
        }
      } catch (err) {
        console.error(`Error fetching media ${mediaId}:`, err);
      }
      return null;
    };

    // Transform product helper function
    const transformProduct = async (product: any) => {
      // Fast path: if skipping variations, do minimal processing
      if (skipVariations) {
        return {
          id: product.id.toString(),
          name: product.name,
          slug: product.slug,
          price: parseFloat(product.price) || 0,
          originalPrice: product.regular_price ? parseFloat(product.regular_price) : undefined,
          discount: product.on_sale && product.regular_price
            ? Math.round(((parseFloat(product.regular_price) - parseFloat(product.price)) / parseFloat(product.regular_price)) * 100)
            : undefined,
          images: product.images?.map((img: any) => img.src).filter(Boolean) || [],
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
          averageRating: product.average_rating,
          ratingCount: product.rating_count,
        };
      }

      // Full processing path (for product detail pages)
      // Get main product images
      const mainImages = product.images?.map((img: any) => img.src) || [];

      // Build image ID to URL map from product images (will be extended with variation images)
      const imageIdToUrl: Record<string, string> = {};
      product.images?.forEach((img: any) => {
        if (img.id && img.src) {
          imageIdToUrl[img.id.toString()] = img.src;
        }
      });
      console.log(`Product ${product.id} initial image ID map: ${Object.keys(imageIdToUrl).length} images`);

      // Helper to resolve image ID to URL using the map first, then fallback to API
      const resolveImageUrl = async (imageId: string): Promise<string | null> => {
        // Normalize image ID
        const normalizedId = String(imageId).trim();
        if (!normalizedId || isNaN(Number(normalizedId))) {
          console.log(`Invalid image ID: ${imageId}`);
          return null;
        }

        // First check if it's in the images map (includes product + variation images)
        if (imageIdToUrl[normalizedId]) {
          console.log(`Image ${normalizedId} found in images map`);
          return imageIdToUrl[normalizedId];
        }
        
        // Fallback to fetching from media API
        console.log(`Image ${normalizedId} not in map, trying media API`);
        const url = await fetchMediaUrl(normalizedId);
        
        // Cache it if found
        if (url) {
          imageIdToUrl[normalizedId] = url;
        }
        
        return url;
      };

      // Initialize variation images array
      let variationImages: { color: string; images: string[]; attributes: any[]; id: number }[] = [];
      let allVariationImageUrls: string[] = [];

      // If product is variable, fetch variations (skip if skipVariations flag is set for performance)
      console.log(`Product ${product.id} type: ${product.type}, variations count: ${product.variations?.length || 0}, skipVariations: ${skipVariations}`);

      if (product.type === 'variable' && !skipVariations) {
        const variations = await fetchVariations(product.id.toString());
        console.log(`Fetched ${variations.length} variations for product ${product.id}`);

        // Add variation images to the map BEFORE processing gallery images
        variations.forEach((variation: any) => {
          if (variation.image?.id && variation.image?.src) {
            imageIdToUrl[variation.image.id.toString()] = variation.image.src;
          }
        });
        console.log(`Updated image ID map with variation images: ${Object.keys(imageIdToUrl).length} total images`);

        // Group variations by color to merge images from multiple variations with same color
        const colorVariationMap: Record<string, { images: string[]; variations: any[] }> = {};

        for (const variation of variations) {
          const colorAttr = variation.attributes?.find(
            (attr: any) => attr.name?.toLowerCase() === 'color' || attr.name?.toLowerCase() === 'colour'
          );
          // Normalize color name for consistent matching
          const colorName = colorAttr?.option ? colorAttr.option.trim() : 'Default';
          console.log(`Variation ${variation.id} color: ${colorName}`);
          console.log(`Variation ${variation.id} has main image:`, !!variation.image?.src);

          // Initialize color entry if not exists
          if (!colorVariationMap[colorName]) {
            colorVariationMap[colorName] = { images: [], variations: [] };
          }

          // Track this variation
          colorVariationMap[colorName].variations.push(variation);

          // Get variation's main image
          const variationMainImage = variation.image?.src;

          // Add main image if it exists and not already in the list
          if (variationMainImage && !colorVariationMap[colorName].images.includes(variationMainImage)) {
            colorVariationMap[colorName].images.push(variationMainImage);
            allVariationImageUrls.push(variationMainImage);
            console.log(`Added main image for variation ${variation.id}, color ${colorName}`);
          }

          // Check multiple possible meta keys for additional variation images
          // Extended list to support various WooCommerce variation gallery plugins
          const possibleMetaKeys = [
            'wpcvi_images', // Primary key from the logs
            '_woo_variation_gallery_images', // Primary key for WooCommerce variation gallery plugin
            '_wc_additional_variation_images',
            'woo_variation_gallery_images',
            'variation_image_gallery',
            '_product_image_gallery',
            'wc_additional_variation_images',
            '_variation_images',
            'variation_images',
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

          const allImageIds: string[] = [];

          console.log(`Variation ${variation.id} available meta keys:`, variation.meta_data?.map((m: any) => m.key));

          // Collect image IDs from all matching meta keys
          for (const metaKey of possibleMetaKeys) {
            const additionalImagesMeta = variation.meta_data?.find(
              (meta: any) => meta.key === metaKey
            );

            if (additionalImagesMeta?.value) {
              console.log(`Found meta key ${metaKey} with value:`, additionalImagesMeta.value);

              // Handle multiple formats: JSON array, comma-separated string, single number, array, or object
              let imageIds: string[] = [];
              const value = additionalImagesMeta.value;

              if (typeof value === 'string') {
                const trimmedValue = value.trim();
                if (!trimmedValue) continue;
                
                try {
                  const parsed = JSON.parse(trimmedValue);
                  if (Array.isArray(parsed)) {
                    imageIds = parsed.map((id: any) => String(id).trim()).filter((id: string) => id && !isNaN(Number(id)));
                  } else if (typeof parsed === 'number') {
                    imageIds = [String(parsed)];
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
                    imageIds = extractIds(parsed);
                  }
                } catch {
                  // Not JSON, treat as comma-separated or single value
                  if (trimmedValue.includes(',')) {
                    imageIds = trimmedValue.split(',').map((id: string) => id.trim()).filter((id: string) => id && !isNaN(Number(id)));
                  } else if (!isNaN(Number(trimmedValue))) {
                    imageIds = [trimmedValue];
                  }
                }
              } else if (Array.isArray(value)) {
                imageIds = value.map((id: any) => String(id).trim()).filter((id: string) => id && !isNaN(Number(id)));
              } else if (typeof value === 'number') {
                imageIds = [String(value)];
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
                imageIds = extractIds(value);
              }
              
              // Filter to ensure valid numeric IDs
              imageIds = imageIds.filter((id: string) => {
                const numId = Number(id);
                return id && !isNaN(numId) && numId > 0;
              });

              if (imageIds.length > 0) {
                console.log(`Extracted image IDs for variation ${variation.id} from ${metaKey}:`, imageIds);
                allImageIds.push(...imageIds);
              }
            }
          }

          // Fetch all unique image IDs
          if (allImageIds.length > 0) {
            const uniqueImageIds = [...new Set(allImageIds)];
            console.log(`Total unique image IDs for variation ${variation.id}:`, uniqueImageIds);
            const imagePromises = uniqueImageIds.map((id: string) => resolveImageUrl(id.trim()));
            const fetchedImages = await Promise.all(imagePromises);
            const validImages = fetchedImages.filter((url): url is string => url !== null);
            
            // Add gallery images that aren't already in the list
            validImages.forEach(url => {
              if (!colorVariationMap[colorName].images.includes(url)) {
                colorVariationMap[colorName].images.push(url);
                allVariationImageUrls.push(url);
              }
            });
            console.log(`Added ${validImages.length} gallery images for variation ${variation.id}, color ${colorName}`);
          } else {
            console.log(`Variation ${variation.id} has no gallery images in meta_data`);
          }
        }

        // Build variation images array from grouped data
        // Use the first variation's attributes for each color group
        for (const [colorName, colorData] of Object.entries(colorVariationMap)) {
          if (colorData.images.length > 0) {
            const firstVariation = colorData.variations[0];
            variationImages.push({
              color: colorName,
              images: [...new Set(colorData.images)].filter(Boolean), // Remove duplicates
              attributes: firstVariation.attributes, // Pass all attributes from first variation
              id: firstVariation.id, // Pass variation ID from first variation
            });
            console.log(`Added variation images for color ${colorName}: ${colorData.images.length} images from ${colorData.variations.length} variations`);
          } else {
            console.log(`Warning: Color ${colorName} has no images (${colorData.variations.length} variations)`);
          }
        }
      }

      // Also check product meta_data for additional images
      const productAdditionalImagesMeta = product.meta_data?.find(
        (meta: any) => meta.key === '_wc_additional_variation_images'
      );

      if (productAdditionalImagesMeta?.value) {
        const imageIds = productAdditionalImagesMeta.value.split(',').filter((id: string) => id.trim());
        const imagePromises = imageIds.map((id: string) => resolveImageUrl(id.trim()));
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
        averageRating: product.average_rating,
        ratingCount: product.rating_count,
      };
    };

    // Handle single product vs multiple products
    let transformedProducts: any[];
    if (productId) {
      // Single product response (object, not array)
      if (skipVariations) {
        // Fast path for single product - basic variation images only (no gallery)
        let variationImages: { color: string; images: string[] }[] = [];

        if (responseData.type === 'variable') {
          try {
            const variationsUrl = `${storeUrl}/wp-json/wc/v3/products/${responseData.id}/variations?per_page=100`;
            const variationsResponse = await fetch(variationsUrl, {
              method: 'GET',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
            });
            if (variationsResponse.ok) {
              const variations = await variationsResponse.json();
              const colorImageMap: Record<string, string> = {};

              for (const variation of variations) {
                const colorAttr = variation.attributes?.find(
                  (attr: any) => attr.name?.toLowerCase() === 'color' || attr.name?.toLowerCase() === 'colour'
                );
                const colorName = colorAttr?.option?.trim() || 'Default';
                if (variation.image?.src && !colorImageMap[colorName]) {
                  colorImageMap[colorName] = variation.image.src;
                }
              }

              variationImages = Object.entries(colorImageMap).map(([color, imageUrl]) => ({
                color,
                images: [imageUrl],
              }));
            }
          } catch (err) {
            console.error(`Error fetching variations for ${responseData.id}:`, err);
          }
        }

        transformedProducts = [{
          id: responseData.id.toString(),
          name: responseData.name,
          slug: responseData.slug,
          price: parseFloat(responseData.price) || 0,
          originalPrice: responseData.regular_price ? parseFloat(responseData.regular_price) : undefined,
          discount: responseData.on_sale && responseData.regular_price
            ? Math.round(((parseFloat(responseData.regular_price) - parseFloat(responseData.price)) / parseFloat(responseData.regular_price)) * 100)
            : undefined,
          images: responseData.images?.map((img: any) => img.src).filter(Boolean) || [],
          variationImages: variationImages.length > 0 ? variationImages : undefined,
          colors: responseData.attributes
            ?.find((attr: any) => attr.name.toLowerCase() === 'color' || attr.name.toLowerCase() === 'colour')
            ?.options || [],
          sizes: responseData.attributes
            ?.find((attr: any) => attr.name.toLowerCase() === 'size')
            ?.options || [],
          category: responseData.categories?.[0]?.name || 'Uncategorized',
          categorySlug: responseData.categories?.[0]?.slug || 'uncategorized',
          categoryId: responseData.categories?.[0]?.id?.toString() || '',
          isNew: responseData.featured,
          isSoldOut: responseData.stock_status === 'outofstock',
          description: responseData.description,
          shortDescription: responseData.short_description,
          inStock: responseData.stock_status === 'instock',
          sku: responseData.sku,
          type: responseData.type,
          averageRating: responseData.average_rating,
          ratingCount: responseData.rating_count,
        }];
        console.log(`Fetched product (fast path): ${responseData.name}`);
      } else {
        // Full processing with gallery images
        const transformed = await transformProduct(responseData);
        transformedProducts = [transformed];
        console.log(`Fetched product: ${responseData.name}`);
      }
    } else {
      // Multiple products response (array)
      if (skipVariations) {
        // Fast transformation with basic variation images (no gallery fetching)
        // Fetch variations in parallel for variable products to get color swatches
        const variableProducts = responseData.filter((p: any) => p.type === 'variable');
        const variationPromises = variableProducts.map(async (product: any) => {
          try {
            const variationsUrl = `${storeUrl}/wp-json/wc/v3/products/${product.id}/variations?per_page=100`;
            const variationsResponse = await fetch(variationsUrl, {
              method: 'GET',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
            });
            if (variationsResponse.ok) {
              return { productId: product.id, variations: await variationsResponse.json() };
            }
          } catch (err) {
            console.error(`Error fetching variations for ${product.id}:`, err);
          }
          return { productId: product.id, variations: [] };
        });

        const variationsResults = await Promise.all(variationPromises);
        const variationsMap: Record<string, any[]> = {};
        variationsResults.forEach(result => {
          variationsMap[result.productId] = result.variations;
        });

        transformedProducts = responseData.map((product: any) => {
          // Build basic variation images from fetched variations (just main image per color, no gallery)
          let variationImages: { color: string; images: string[] }[] = [];

          if (product.type === 'variable' && variationsMap[product.id]) {
            const colorImageMap: Record<string, string> = {};

            for (const variation of variationsMap[product.id]) {
              const colorAttr = variation.attributes?.find(
                (attr: any) => attr.name?.toLowerCase() === 'color' || attr.name?.toLowerCase() === 'colour'
              );
              const colorName = colorAttr?.option?.trim() || 'Default';

              // Only use main variation image (skip gallery for speed)
              if (variation.image?.src && !colorImageMap[colorName]) {
                colorImageMap[colorName] = variation.image.src;
              }
            }

            // Convert map to array format
            variationImages = Object.entries(colorImageMap).map(([color, imageUrl]) => ({
              color,
              images: [imageUrl],
            }));
          }

          return {
            id: product.id.toString(),
            name: product.name,
            slug: product.slug,
            price: parseFloat(product.price) || 0,
            originalPrice: product.regular_price ? parseFloat(product.regular_price) : undefined,
            discount: product.on_sale && product.regular_price
              ? Math.round(((parseFloat(product.regular_price) - parseFloat(product.price)) / parseFloat(product.regular_price)) * 100)
              : undefined,
            images: product.images?.map((img: any) => img.src).filter(Boolean) || [],
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
            averageRating: product.average_rating,
            ratingCount: product.rating_count,
          };
        });
        console.log(`Fetched ${responseData.length} products (fast path with basic variation images)`);
      } else {
        // Full processing with variations
        transformedProducts = await Promise.all(responseData.map(transformProduct));
        console.log(`Fetched ${responseData.length} products`);
      }
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
