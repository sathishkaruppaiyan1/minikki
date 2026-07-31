import Layout from "@/components/layout/Layout";
import { useEffect } from "react";

import HeroBanner from "@/components/home/HeroBanner";
import CategoryCarousel from "@/components/home/CategoryCarousel";
import CategoryGrid from "@/components/home/CategoryGrid";
import ProductSection from "@/components/home/ProductSection";
import ReviewsSlider from "@/components/home/ReviewsSlider";
import StorySection from "@/components/home/StorySection";
import {
  useWooCommerceProducts,
  useWooCommerceProductsByIds,
} from "@/hooks/useWooCommerce";
import { useHomeConfig } from "@/hooks/useHomeConfig";
import type { HomeProductSection } from "@/hooks/useHomeConfig";
import type { Product } from "@/types/product";
import { Skeleton } from "@/components/ui/skeleton";
import { preloadImages, getProductCardImage } from "@/lib/imageOptimizer";

const ProductSectionSkeleton = () => (
  <div className="container mx-auto px-4 py-8 lg:py-16">
    <div className="flex justify-center mb-8">
      <Skeleton className="h-10 w-48" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-[300px] w-full rounded-none" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Resolves one homepage product row.
 *
 * When the WordPress plugin pins an explicit product list we fetch exactly those
 * IDs and keep the curated order. Otherwise we keep the original tag-driven
 * behaviour, so the page works unchanged without the plugin.
 */
const useHomeProductRow = (
  section: HomeProductSection | undefined,
  fallbackTag: string
): { products: Product[]; isLoading: boolean; error: unknown } => {
  const manualIds = section?.source === "manual" ? section.product_ids : [];
  const useManual = manualIds.length > 0;

  const manual = useWooCommerceProductsByIds(manualIds, useManual);

  const tagged = useWooCommerceProducts({
    perPage: 8,
    tag: section?.tag || fallbackTag,
    skipVariations: true,
    enabled: !useManual,
  });

  if (useManual) {
    return { products: manual.data || [], isLoading: manual.isLoading, error: manual.error };
  }

  return {
    products: tagged.data?.products || [],
    isLoading: tagged.isLoading,
    error: tagged.error,
  };
};

const Index = () => {
  const { data: config } = useHomeConfig();

  const newArrivalsConfig = config?.new_arrivals;
  const hotSellersConfig = config?.hot_sellers;

  const newArrivalsRow = useHomeProductRow(newArrivalsConfig, "new-arrivals");
  const hotSellersRow = useHomeProductRow(hotSellersConfig, "hot-sellers");

  const newArrivals = newArrivalsRow.products;
  const displayHotSellers = hotSellersRow.products;

  const showNewArrivals = !newArrivalsConfig || newArrivalsConfig.enabled;
  const showHotSellers = !hotSellersConfig || hotSellersConfig.enabled;

  // Preload critical above-the-fold images (first 4 products) for instant display
  useEffect(() => {
    if (newArrivals.length > 0) {
      const criticalImages = newArrivals
        .slice(0, 4)
        .map(p => p.images[0])
        .filter(Boolean)
        .map(img => img.startsWith("/") || img.startsWith("data:") ? img : getProductCardImage(img));

      if (criticalImages.length > 0) {
        preloadImages(criticalImages).catch(() => {
          // Silently fail - images will load normally
        });
      }
    }
  }, [newArrivals]);

  return (
    <Layout>
      <CategoryCarousel />
      <HeroBanner />

      {/* Optional banner strip below the hero, managed in WordPress */}
      <HeroBanner placement="below_hero" />

      {/* Categories load independently and show immediately */}
      <CategoryGrid />

      {/* Products section - show products immediately when available */}
      {newArrivalsRow.error ? (
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Failed to load products. Please try again.</p>
        </div>
      ) : (
        <>
          {showNewArrivals && (
            newArrivals.length > 0 ? (
              <ProductSection
                title={newArrivalsConfig?.title || "New Arrivals"}
                products={newArrivals}
                viewAllLink={newArrivalsConfig?.view_all_link || "/collections/all"}
              />
            ) : newArrivalsRow.isLoading ? (
              <ProductSectionSkeleton />
            ) : null
          )}

          {showHotSellers && (
            displayHotSellers.length > 0 ? (
              <ProductSection
                title={hotSellersConfig?.title || "Hot Sellers"}
                products={displayHotSellers}
                viewAllLink={hotSellersConfig?.view_all_link || "/collections/all"}
              />
            ) : hotSellersRow.isLoading ? (
              <ProductSectionSkeleton />
            ) : null
          )}

          <ReviewsSlider />

          <StorySection />
        </>
      )}
    </Layout>
  );
};

export default Index;
