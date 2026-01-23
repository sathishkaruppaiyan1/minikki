import { useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useWordPressPages } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";

// Map of route slugs to WordPress page slugs (supports multiple variations)
const slugMap: Record<string, string[]> = {
  "about": ["about-us", "about", "about-us-2"],
  "terms": ["terms-conditions", "terms-and-conditions", "terms", "tnc"],
  "shipping": ["shipping-policy", "shipping", "delivery-policy"],
  "privacy": ["privacy-policy", "privacy"],
  "refund": ["refund-returns", "refund-and-returns", "refund", "returns", "return-policy"],
};

// Page titles for fallback
const pageTitles: Record<string, string> = {
  "about": "About Us",
  "terms": "Terms & Conditions",
  "shipping": "Shipping Policy",
  "privacy": "Privacy Policy",
  "refund": "Refund & Returns",
};

const WordPressPage = () => {
  const { slug: paramSlug } = useParams();
  const location = useLocation();

  // Get slug from URL param or from pathname (for shortcut routes like /about)
  const pathSlug = location.pathname.replace("/", "").split("/")[0];
  const routeSlug = paramSlug || pathSlug;

  // Get all possible WordPress slugs for this route
  const possibleSlugs = routeSlug ? (slugMap[routeSlug] || [routeSlug]) : [];
  const fallbackTitle = routeSlug ? (pageTitles[routeSlug] || routeSlug) : "";

  // Fetch all pages and find matching one
  const { data: allPages, isLoading, error } = useWordPressPages();

  // Find the page that matches any of our possible slugs
  const page = useMemo(() => {
    if (!allPages || !possibleSlugs.length) return null;
    return allPages.find(p => possibleSlugs.includes(p.slug)) || null;
  }, [allPages, possibleSlugs]);

  return (
    <Layout>
      {/* Page Header */}
      <div className="bg-[#FFF9E5] py-8 text-center">
        <h1 className="font-heading text-3xl lg:text-4xl">
          {isLoading ? (
            <Skeleton className="h-10 w-48 mx-auto" />
          ) : (
            page?.title || fallbackTitle
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Home &gt; {page?.title || fallbackTitle}
        </p>
      </div>

      <div className="container mx-auto px-4 py-8 lg:py-12">
        {isLoading ? (
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Failed to load page content. Please try again later.</p>
          </div>
        ) : page ? (
          <div className="max-w-4xl mx-auto">
            <div
              className="prose prose-lg max-w-none
                prose-headings:font-heading prose-headings:text-foreground
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-strong:text-foreground
                prose-ul:text-muted-foreground prose-ol:text-muted-foreground
                prose-li:marker:text-primary"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Page not found.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WordPressPage;
