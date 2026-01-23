import { Link } from 'react-router-dom';
import Layout from "@/components/layout/Layout";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";

import CategoryGrid from "@/components/home/CategoryGrid";
import ProductSection from "@/components/home/ProductSection";
import StorySection from "@/components/home/StorySection";
import ReviewsSlider from "@/components/home/ReviewsSlider";
import { useWooCommerceProductsInfinite, useWooCommerceCategories } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const Index = () => {
  // Use infinite scroll - load only 8 products initially, then load more on scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useWooCommerceProductsInfinite({
    perPage: 8, // Load 8 products per page for faster initial load
    skipVariations: true,
  });

  const { data: categories } = useWooCommerceCategories();
  const observerTarget = useRef<HTMLDivElement>(null);

  // Flatten all pages into a single products array
  const allProducts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.products || []);
  }, [data?.pages]);

  // Memoize expensive operations - only recalculate when products change
  const { newArrivals, displayHotSellers } = useMemo(() => {
    const sortedProducts = [...allProducts].sort((a, b) => parseInt(b.id) - parseInt(a.id));

    // New Arrivals - first 8 products (or less if not available yet)
    const newArrivals = sortedProducts.slice(0, 8);

    // Hot Sellers - next 8 products (or reuse reversed if not enough)
    const hotSellersSource = sortedProducts.slice(8, 16);
    const displayHotSellers = hotSellersSource.length >= 4
      ? hotSellersSource
      : sortedProducts.length >= 4
        ? sortedProducts.slice(0, Math.min(8, sortedProducts.length)).reverse()
        : [];

    return { newArrivals, displayHotSellers };
  }, [allProducts]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Layout>
      <div className="w-full">
        <Link to="/collections/all">
          <img src="/new_arrival_banner.jpg" alt="Shop Now" className="w-full h-auto object-cover" />
        </Link>
      </div>
      {/* Categories load independently and show immediately */}
      <CategoryGrid />
      
      {/* Products section - show products immediately when available */}
      {error ? (
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Failed to load products. Please try again.</p>
        </div>
      ) : (
        <>
          {/* Show New Arrivals immediately when we have products - don't wait for all 8 */}
          {newArrivals.length > 0 ? (
            <ProductSection
              title="New Arrivals"
              emoji="🔥"
              products={newArrivals}
              viewAllLink="/collections/all"
            />
          ) : isLoading ? (
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
          ) : null}

          {/* Show Hot Sellers when we have enough products */}
          {displayHotSellers.length > 0 ? (
            <ProductSection
              title="Hot Sellers"
              emoji="⚡"
              products={displayHotSellers}
              viewAllLink="/collections/all"
            />
          ) : isLoading && newArrivals.length === 0 ? (
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
          ) : null}

          {/* Intersection Observer target for infinite scroll - Always render to prevent layout shifts */}
          <div 
            ref={observerTarget} 
            className={hasNextPage ? "py-8" : "py-0"}
            style={{ minHeight: hasNextPage ? '1px' : '0' }}
          >
            {isFetchingNextPage && (
              <div className="container mx-auto px-4">
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
            )}
          </div>

          {/* Load More Button (fallback if intersection observer doesn't work) */}
          {hasNextPage && !isFetchingNextPage && (
            <div className="container mx-auto px-4 py-8 text-center">
              <Button
                onClick={() => fetchNextPage()}
                className="bg-[#800000] text-white hover:bg-[#600000]"
              >
                Load More Products
              </Button>
            </div>
          )}

          <ReviewsSlider />
          <StorySection />
        </>
      )}
    </Layout>
  );
};

export default Index;
