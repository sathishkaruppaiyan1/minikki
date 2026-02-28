import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client (service role for storage & DB writes)
const getSupabaseClient = () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Supabase credentials missing');
        throw new Error('Supabase credentials not configured');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
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
        const url = new URL(req.url);

        // ─── GET: Fetch Reviews ───
        if (req.method === 'GET') {
            const productId = url.searchParams.get('product_id');
            let apiUrl = `${storeUrl}/wp-json/wc/v3/products/reviews?per_page=50&status=approved`;

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
            console.log(`Fetched ${reviews.length} reviews`);

            // Double-check status filter
            const approvedReviews = reviews.filter((r: any) => r.status === 'approved');

            // Fetch media from Supabase review_media table
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
                        console.warn('Could not fetch review media:', mediaError.message);
                    } else if (mediaData) {
                        mediaData.forEach((item: any) => {
                            mediaMap[item.review_id] = item.media_urls || [];
                        });
                        console.log(`Fetched media for ${mediaData.length} reviews`);
                    }
                }
            } catch (mediaErr) {
                console.warn('Error fetching review media:', mediaErr);
            }

            // Attach media to reviews
            const reviewsWithMedia = approvedReviews.map((review: any) => ({
                ...review,
                media: mediaMap[review.id] || [],
            }));

            return new Response(
                JSON.stringify({ reviews: reviewsWithMedia }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ─── POST: Submit Review ───
        if (req.method === 'POST') {
            const body = await req.json();
            const { product_id, review, reviewer, reviewer_email, rating, images } = body;

            if (!product_id || !review || !reviewer || !reviewer_email || !rating) {
                throw new Error("Missing required fields");
            }

            console.log(`Submitting review for product ${product_id} by ${reviewer}`);

            // Truncate review if too long
            const MAX_REVIEW_LENGTH = 5000;
            let finalReviewContent = review;
            if (finalReviewContent.length > MAX_REVIEW_LENGTH) {
                finalReviewContent = finalReviewContent.substring(0, MAX_REVIEW_LENGTH) + '...';
            }

            // Submit review to WooCommerce
            const reviewData = {
                product_id,
                review: finalReviewContent,
                reviewer,
                reviewer_email,
                rating,
                verified: false,
                status: "hold",
            };

            const wcResponse = await fetch(`${storeUrl}/wp-json/wc/v3/products/reviews`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewData),
            });

            if (!wcResponse.ok) {
                const errorText = await wcResponse.text();
                console.error('WooCommerce review error:', wcResponse.status, errorText);
                throw new Error(`WooCommerce API error: ${wcResponse.status} - ${errorText}`);
            }

            const newReview = await wcResponse.json();
            const reviewId = newReview.id;
            console.log(`Review created with ID: ${reviewId}`);

            // Upload images to Supabase Storage
            let uploadWarning = null;
            const uploadedMedia: string[] = [];

            if (images && Array.isArray(images) && images.length > 0) {
                console.log(`Processing ${images.length} images for review ${reviewId}`);

                try {
                    const supabase = getSupabaseClient();
                    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');

                    for (let i = 0; i < images.length; i++) {
                        const base64Data = images[i];
                        if (!base64Data) continue;

                        // Extract mime type and data
                        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
                        if (!matches) {
                            console.error(`Invalid base64 format for image ${i}`);
                            continue;
                        }

                        const mimeType = matches[1];
                        const base64Content = matches[2];
                        const isVideo = mimeType.startsWith('video/');
                        const extension = mimeType.split('/')[1]?.replace('+xml', '') || (isVideo ? 'mp4' : 'jpg');

                        // Convert base64 to binary
                        const binaryString = atob(base64Content);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let j = 0; j < binaryString.length; j++) {
                            bytes[j] = binaryString.charCodeAt(j);
                        }

                        // Upload to Supabase Storage
                        const filePath = `reviews/${product_id}/${reviewId}-${Date.now()}-${i}.${extension}`;
                        console.log(`Uploading to Supabase Storage: ${filePath} (${bytes.length} bytes)`);

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('review-media')
                            .upload(filePath, bytes, {
                                contentType: mimeType,
                                upsert: false,
                            });

                        if (uploadError) {
                            console.error(`Storage upload error for image ${i + 1}:`, uploadError.message);
                            continue;
                        }

                        // Get public URL
                        const { data: urlData } = supabase.storage
                            .from('review-media')
                            .getPublicUrl(filePath);

                        if (urlData?.publicUrl) {
                            uploadedMedia.push(urlData.publicUrl);
                            console.log(`Uploaded image ${i + 1}: ${urlData.publicUrl}`);
                        }
                    }

                    console.log(`Total uploaded: ${uploadedMedia.length}/${images.length}`);

                    // Save media references to review_media table
                    if (uploadedMedia.length > 0) {
                        const { error: dbError } = await supabase
                            .from('review_media')
                            .insert({
                                review_id: reviewId,
                                product_id: product_id,
                                media_urls: uploadedMedia,
                                reviewer_email: reviewer_email,
                            });

                        if (dbError) {
                            console.error('DB error saving media refs:', dbError.message);
                        } else {
                            console.log(`Saved ${uploadedMedia.length} media URLs for review ${reviewId}`);
                        }
                    }
                } catch (mediaError) {
                    console.error('Error processing media:', mediaError);
                    uploadWarning = mediaError instanceof Error ? mediaError.message : String(mediaError);
                }
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    review: newReview,
                    mediaUploaded: uploadedMedia.length,
                    warning: uploadWarning,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
