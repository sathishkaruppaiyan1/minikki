import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const getSupabaseClient = () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('Supabase credentials missing in getSupabaseClient');
    }

    return createClient(supabaseUrl || '', supabaseServiceKey || '');
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

        // Remove trailing slash
        const storeUrl = storeUrlRaw.replace(/\/+$/, '');
        const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);
        const url = new URL(req.url);

        // GET Request: Fetch Reviews
        if (req.method === 'GET') {
            const productId = url.searchParams.get('product_id');
            // Fetch all reviews (WooCommerce returns approved by default for public API)
            let apiUrl = `${storeUrl}/wp-json/wc/v3/products/reviews?per_page=50`;

            if (productId) {
                apiUrl += `&product=${productId}`;
            }

            console.log('Fetching reviews from:', apiUrl);

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

            const reviews = await response.json();
            console.log(`Fetched ${reviews.length} reviews from WooCommerce`);

            // Filter to only show approved reviews
            const approvedReviews = reviews.filter((r: any) => r.status === 'approved');
            console.log(`${approvedReviews.length} approved reviews`);

            // Try to fetch media from Supabase (don't fail if table doesn't exist)
            let mediaMap: Record<number, string[]> = {};

            try {
                const supabase = getSupabaseClient();
                const reviewIds = approvedReviews.map((r: any) => r.id);

                if (reviewIds.length > 0) {
                    const { data: mediaData, error: mediaError } = await supabase
                        .from('review_media')
                        .select('review_id, media_urls')
                        .in('review_id', reviewIds);

                    if (mediaError) {
                        console.warn('Could not fetch review media (table may not exist):', mediaError.message);
                    } else if (mediaData) {
                        mediaData.forEach((item: any) => {
                            mediaMap[item.review_id] = item.media_urls || [];
                        });
                        console.log(`Fetched media for ${mediaData.length} reviews`);
                    }
                }
            } catch (mediaErr) {
                console.warn('Error fetching review media:', mediaErr);
                // Continue without media
            }

            // Attach media to reviews
            const reviewsWithMedia = approvedReviews.map((review: any) => ({
                ...review,
                media: mediaMap[review.id] || []
            }));

            return new Response(
                JSON.stringify({ reviews: reviewsWithMedia }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // POST Request: Submit Review
        if (req.method === 'POST') {
            const body = await req.json();
            const { product_id, review, reviewer, reviewer_email, rating, images } = body;

            if (!product_id || !review || !reviewer || !reviewer_email || !rating) {
                throw new Error("Missing required fields");
            }

            console.log(`Submitting review for product ${product_id} by ${reviewer}`);

            // Truncate review content if too long
            const MAX_REVIEW_LENGTH = 5000;
            let finalReviewContent = review;

            if (finalReviewContent.length > MAX_REVIEW_LENGTH) {
                finalReviewContent = finalReviewContent.substring(0, MAX_REVIEW_LENGTH) + '...';
                console.log('Review content truncated to', MAX_REVIEW_LENGTH, 'characters');
            }

            // Submit review to WooCommerce with status "hold" (unapproved)
            const reviewData = {
                product_id,
                review: finalReviewContent,
                reviewer,
                reviewer_email,
                rating,
                verified: false,
                status: "hold" // Review requires admin approval
            };

            const apiUrl = `${storeUrl}/wp-json/wc/v3/products/reviews`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('WooCommerce API error:', response.status, errorText);
                throw new Error(`WooCommerce API error: ${response.status} - ${errorText}`);
            }

            const newReview = await response.json();
            const reviewId = newReview.id;

            // Upload images/videos to WordPress Media Library
            console.log(`Processing ${images?.length || 0} images for review ${reviewId}`);
            let uploadWarning = null;
            const uploadedMedia: string[] = [];

            if (images && Array.isArray(images) && images.length > 0) {
                try {
                    for (let i = 0; i < images.length; i++) {
                        const base64Data = images[i];
                        console.log(`Processing image ${i + 1}, data length: ${base64Data?.length || 0}`);

                        // Extract mime type and data from base64 string
                        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
                        if (!matches) {
                            console.error(`Invalid base64 format for image ${i}. Starts with:`, base64Data?.substring(0, 50));
                            continue;
                        }

                        const mimeType = matches[1];
                        const base64Content = matches[2];
                        const isVideo = mimeType.startsWith('video/');
                        const extension = mimeType.split('/')[1]?.replace('+xml', '') || (isVideo ? 'mp4' : 'jpg');

                        console.log(`Image ${i + 1}: mimeType=${mimeType}, extension=${extension}`);

                        // Convert base64 to Uint8Array
                        const binaryString = atob(base64Content);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let j = 0; j < binaryString.length; j++) {
                            bytes[j] = binaryString.charCodeAt(j);
                        }

                        console.log(`Image ${i + 1}: converted to ${bytes.length} bytes`);

                        // Generate unique filename
                        const fileName = `review-${reviewId}-${Date.now()}-${i}.${extension}`;

                        // Upload to WordPress Media Library
                        const mediaApiUrl = `${storeUrl}/wp-json/wp/v2/media`;
                        console.log(`Uploading to WordPress: ${mediaApiUrl}`);

                        // Create FormData for multipart upload
                        const formData = new FormData();
                        const blob = new Blob([bytes], { type: mimeType });
                        formData.append('file', blob, fileName);
                        formData.append('title', `Review Image ${i + 1} for Product ${product_id}`);
                        formData.append('description', `Review image uploaded by ${reviewer}`);

                        const mediaResponse = await fetch(mediaApiUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': authHeader,
                            },
                            body: formData
                        });

                        if (!mediaResponse.ok) {
                            const errorText = await mediaResponse.text();
                            console.error(`WordPress upload error for image ${i + 1}:`, mediaResponse.status, errorText);
                            continue;
                        }

                        const mediaData = await mediaResponse.json();
                        const mediaUrl = mediaData.source_url || mediaData.guid?.rendered || mediaData.media_details?.sizes?.full?.source_url || null;

                        if (mediaUrl) {
                            uploadedMedia.push(mediaUrl);
                            console.log(`WordPress upload successful for image ${i + 1}:`, mediaUrl);
                        } else {
                            console.error(`No URL returned for uploaded image ${i + 1}`);
                        }
                    }

                    console.log(`Total uploaded media: ${uploadedMedia.length}`);

                    // Save media references to Supabase database (for tracking)
                    if (uploadedMedia.length > 0) {
                        try {
                            const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
                            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

                            if (supabaseUrl && supabaseServiceKey) {
                                const supabase = createClient(supabaseUrl, supabaseServiceKey);
                                console.log('Saving to review_media table...');
                                const { data: insertData, error: dbError } = await supabase
                                    .from('review_media')
                                    .insert({
                                        review_id: reviewId,
                                        product_id: product_id,
                                        media_urls: uploadedMedia,
                                        reviewer_email: reviewer_email
                                    })
                                    .select();

                                if (dbError) {
                                    console.error('Database error saving media references:', JSON.stringify(dbError));
                                } else {
                                    console.log(`Saved ${uploadedMedia.length} media files for review ${reviewId}`, insertData);
                                }
                            }
                        } catch (dbError) {
                            console.warn('Could not save media references to database:', dbError);
                            // Continue even if database save fails
                        }
                    }
                } catch (mediaError) {
                    console.error('Error processing media:', mediaError);
                    uploadWarning = `Error processing media: ${mediaError instanceof Error ? mediaError.message : String(mediaError)}`;
                }
            } else {
                console.log('No images to process');
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    review: newReview,
                    warning: uploadWarning
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: corsHeaders }
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in woocommerce-reviews function:', errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
