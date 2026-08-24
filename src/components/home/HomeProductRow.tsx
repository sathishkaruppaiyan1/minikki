import { useEffect } from "react";
import ProductSlider from "@/components/home/ProductSlider";
import ProductSection from "@/components/home/ProductSection";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWooCommerceProducts,
  useWooCommerceProductsByIds,
} from "@/hooks/useWooCommerce";
import type { HomeProductSection } from "@/hooks/useHomeConfig";
import { preloadImages, getProductCardImage } from "@/lib/imageOptimizer";

interface HomeProductRowProps {
  section: HomeProductSection;
  /** Preload this row's first images — set on the topmost row only. */
  priority?: boolean;
}

const RowSkeleton = () => (
  <div className="container mx-auto px-4 py-8 lg:py-16">
    <div className="mb-8 flex justify-between">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-32 rounded-full" />
    </div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-[10px]" />
      ))}
    </div>
  </div>
);

/**
 * One homepage product row.
 *
 * Each row owns its own data fetching so the plugin can add or remove rows
 * without changing the number of hooks the page runs.
 */
const HomeProductRow = ({ section, priority = false }: HomeProductRowProps) => {
  const limit = section.limit > 0 ? section.limit : 8;

  // Each source is mutually exclusive. A row whose source is not usable yet
  // (manual with nothing picked, category with no category) renders nothing
  // rather than silently falling back to another row's products.
  const manualIds = section.source === "manual" ? section.product_ids : [];
  const useManual = section.source === "manual" && manualIds.length > 0;
  const useCategory = section.source === "category" && !!section.category_slug;
  const useTag = section.source === "tag" && !!section.tag;

  const manual = useWooCommerceProductsByIds(manualIds, useManual);

  const byCategory = useWooCommerceProducts({
    perPage: limit,
    category: section.category_slug,
    skipVariations: true,
    enabled: useCategory,
  });

  const byTag = useWooCommerceProducts({
    perPage: limit,
    tag: section.tag,
    skipVariations: true,
    enabled: useTag,
  });

  const active = useManual
    ? { products: manual.data || [], isLoading: manual.isLoading, error: manual.error }
    : useCategory
      ? {
          products: byCategory.data?.products || [],
          isLoading: byCategory.isLoading,
          error: byCategory.error,
        }
      : {
          products: byTag.data?.products || [],
          isLoading: byTag.isLoading,
          error: byTag.error,
        };

  // The limit is a cap for the automatic sources only — a hand-picked list is
  // shown in full, however long it is.
  const products = useManual ? active.products : active.products.slice(0, limit);

  // Preload the above-the-fold images of the first row for instant display.
  useEffect(() => {
    if (!priority || products.length === 0) return;

    const critical = products
      .slice(0, 4)
      .map((p) => p.images[0])
      .filter(Boolean)
      .map((img) =>
        img.startsWith("/") || img.startsWith("data:") ? img : getProductCardImage(img)
      );

    if (critical.length > 0) {
      preloadImages(critical).catch(() => {
        // Silently fail - images will load normally
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priority, products.map((p) => p.id).join(",")]);

  if (!section.enabled) return null;

  if (products.length === 0) {
    return active.isLoading ? <RowSkeleton /> : null;
  }

  if (section.layout === "grid") {
    return (
      <ProductSection
        title={section.title}
        products={products}
        viewAllLink={section.view_all_link}
      />
    );
  }

  return (
    <ProductSlider
      title={section.title}
      products={products}
      viewAllLink={section.view_all_link}
    />
  );
};

export default HomeProductRow;
