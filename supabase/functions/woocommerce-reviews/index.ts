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

        // Remove trailing slash
        const storeUrl = storeUrlRaw.replace(/\/+$/, '');
        const authHeader = 'Basic ' + btoa(`${consumerKey}:${consumerSecret}`);
        const url = new URL(req.url);

        // GET Request: Fetch Reviews
        if (req.method === 'GET') {
            const productId = url.searchParams.get('product_id');
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

            return new Response(
                JSON.stringify({ reviews }),
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

            // WooCommerce has a strict column length limit for reviews
            // We cannot embed base64 images directly in the review content
            // Images should be handled separately via WordPress Media Library
            // For now, we'll just use the text review and ignore images to prevent the length error
            
            // Truncate review content if too long (WC typically allows ~65535 chars but safer to limit)
            const MAX_REVIEW_LENGTH = 5000;
            let finalReviewContent = review;
            
            if (finalReviewContent.length > MAX_REVIEW_LENGTH) {
                finalReviewContent = finalReviewContent.substring(0, MAX_REVIEW_LENGTH) + '...';
                console.log('Review content truncated to', MAX_REVIEW_LENGTH, 'characters');
            }

            // Log if images were provided but we're not processing them
            if (images && Array.isArray(images) && images.length > 0) {
                console.log(`Note: ${images.length} image(s) provided but not embedded (WC content length limit). Consider WordPress Media Library integration for image reviews.`);
            }

            const reviewData = {
                product_id,
                review: finalReviewContent,
                reviewer,
                reviewer_email,
                rating,
                verified: false
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

            return new Response(
                JSON.stringify({ success: true, review: newReview }),
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
