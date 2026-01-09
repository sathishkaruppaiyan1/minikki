import { Link } from 'react-router-dom';
import Layout from "@/components/layout/Layout";

import CategoryGrid from "@/components/home/CategoryGrid";
import ProductSection from "@/components/home/ProductSection";
import StorySection from "@/components/home/StorySection";
import ReviewsSlider from "@/components/home/ReviewsSlider";
import { useWooCommerceProducts } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";
import LoadingScreen from "@/components/ui/LoadingScreen";

const Index = () => {
  const { data, isLoading, error } = useWooCommerceProducts({ perPage: 16 });

  const products = data?.products
    ? [...data.products].sort((a, b) => parseInt(b.id) - parseInt(a.id))
    : [];

  // Ensure we have 8 products for New Arrivals, duplicating if necessary
  const newArrivalsSource = products.slice(0, 8);
  const newArrivals = newArrivalsSource.length > 0
    ? [...newArrivalsSource, ...newArrivalsSource, ...newArrivalsSource].slice(0, 8)
    : [];

  // Ensure we have 8 products for Hot Sellers
  const hotSellersSource = products.slice(8, 16);
  // If we don't have enough distinct hot sellers, reuse products or duplicate whatever we have
  const displayHotSellersSource = hotSellersSource.length > 0 ? hotSellersSource : products.slice(0, 8).reverse();
  const displayHotSellers = displayHotSellersSource.length > 0
    ? [...displayHotSellersSource, ...displayHotSellersSource, ...displayHotSellersSource].slice(0, 8)
    : [];

  return (
    <Layout>
      <div className="w-full">
        <Link to="/collections/all">
          <img src="/new_arrival_banner.jpg" alt="Shop Now" className="w-full h-auto object-cover" />
        </Link>
      </div>
      <CategoryGrid />
      {isLoading ? (
        <LoadingScreen />
      ) : error ? (
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Failed to load products. Please try again.</p>
        </div>
      ) : (
        <>
          <ProductSection
            title="New Arrivals"
            emoji="🔥"
            products={newArrivals}
            viewAllLink="/collections/all"
          />

          <ProductSection
            title="Hot Sellers"
            emoji="⚡"
            products={displayHotSellers}
            viewAllLink="/collections/all"
          />

          <ReviewsSlider />
          <StorySection />
        </>
      )}
    </Layout>
  );
};

export default Index;
