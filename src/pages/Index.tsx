import Layout from "@/components/layout/Layout";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryGrid from "@/components/home/CategoryGrid";
import ProductSection from "@/components/home/ProductSection";
import StorySection from "@/components/home/StorySection";
import ShopByReels from "@/components/home/ShopByReels";
import ReviewsSlider from "@/components/home/ReviewsSlider";
import { useWooCommerceProducts } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { data, isLoading, error } = useWooCommerceProducts({ perPage: 12 });

  const products = data?.products || [];
  const bestSellers = products.slice(0, 8);
  const newArrivals = products.filter(p => p.isNew).concat(products.slice(0, 4)).slice(0, 4);

  return (
    <Layout>
      <HeroBanner />
      <CategoryGrid />
      {isLoading ? (
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Failed to load products. Please try again.</p>
        </div>
      ) : (
        <>
          <ProductSection
            title="Hot Sellers"
            emoji="🔥"
            products={bestSellers}
            viewAllLink="/collections/all"
          />
          <ShopByReels />
          <ReviewsSlider />
          <StorySection />
          <ProductSection
            title="New Arrivals"
            products={newArrivals}
            viewAllLink="/collections/all"
          />
        </>
      )}
    </Layout>
  );
};

export default Index;
