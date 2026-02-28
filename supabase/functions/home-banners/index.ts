import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const storeUrlRaw = Deno.env.get('WOOCOMMERCE_STORE_URL');
        if (!storeUrlRaw) throw new Error('WOOCOMMERCE_STORE_URL not configured');
        const storeUrl = storeUrlRaw.replace(/\/+$/, '');

        // Step 1: Get category ID for "home-banners"
        const catRes = await fetch(
            `${storeUrl}/wp-json/wp/v2/categories?slug=home-banners`,
            { headers: { 'Content-Type': 'application/json' } }
        );
        if (!catRes.ok) throw new Error(`Failed to fetch category: ${catRes.status}`);
        const cats = await catRes.json();

        if (!cats.length) {
            console.log('Category "home-banners" not found — returning empty');
            return new Response(
                JSON.stringify({ banners: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const categoryId = cats[0].id;

        // Step 2: Fetch published posts in "home-banners" category, ordered by date ascending
        // Note: public WP REST API only returns published posts by default, no status param needed
        const postsRes = await fetch(
            `${storeUrl}/wp-json/wp/v2/posts?categories=${categoryId}&per_page=20&orderby=date&order=asc&_embed=wp:featuredmedia`,
            { headers: { 'Content-Type': 'application/json' } }
        );
        if (!postsRes.ok) {
            const errText = await postsRes.text();
            console.error('Posts fetch error:', postsRes.status, errText);
            throw new Error(`Failed to fetch posts: ${postsRes.status}`);
        }
        const posts = await postsRes.json();

        // Step 3: Transform posts into banner objects
        const banners = posts.map((post: any, index: number) => {
            // Featured image URL
            const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
            const imageUrl = featuredMedia?.source_url
                || featuredMedia?.media_details?.sizes?.full?.source_url
                || '';

            // Mobile image from ACF field (optional)
            const mobileImageUrl = post.acf?.mobile_image?.url
                || post.acf?.mobile_image_url
                || post.acf?.mobile_banner
                || null;

            // Redirect link: check ACF fields first, then excerpt (stripped HTML)
            let redirectLink = '/collections/all'; // default

            // Check ACF fields
            if (post.acf) {
                const acfLink = post.acf.redirect_link
                    || post.acf.banner_link
                    || post.acf.link
                    || post.acf.url;
                if (acfLink && typeof acfLink === 'string' && acfLink.trim()) {
                    redirectLink = acfLink.trim();
                }
            }

            // Fallback: use excerpt (strip HTML tags)
            if (redirectLink === '/collections/all' && post.excerpt?.rendered) {
                const stripped = post.excerpt.rendered
                    .replace(/<[^>]*>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&#8217;/g, "'")
                    .replace(/&nbsp;/g, ' ')
                    .trim();
                if (stripped && (stripped.startsWith('/') || stripped.startsWith('http'))) {
                    redirectLink = stripped;
                }
            }

            // Alt text from post title
            const altText = post.title?.rendered
                ?.replace(/<[^>]*>/g, '')
                ?.replace(/&amp;/g, '&')
                ?.trim() || 'Banner';

            return {
                id: post.id,
                image_url: imageUrl,
                mobile_image_url: mobileImageUrl,
                redirect_link: redirectLink,
                alt_text: altText,
                is_active: true,
                display_order: index + 1,
            };
        }).filter((b: any) => b.image_url); // Only include banners that have an image

        console.log(`Fetched ${banners.length} banners from WordPress`);

        return new Response(
            JSON.stringify({ banners }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in home-banners function:', errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
