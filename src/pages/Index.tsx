import Layout from "@/components/layout/Layout";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryGrid from "@/components/home/CategoryGrid";
import ProductSection from "@/components/home/ProductSection";
import StorySection from "@/components/home/StorySection";
import { products } from "@/data/products";

const Index = () => {
  const bestSellers = products.slice(0, 8);
  const newArrivals = products.filter(p => p.isNew).concat(products.slice(0, 4)).slice(0, 4);

  return (
    <Layout>
      <HeroBanner />
      <CategoryGrid />
      <ProductSection
        title="Hot Sellers"
        emoji="🔥"
        products={bestSellers}
        viewAllLink="/collections/best-sellers"
      />
      <StorySection />
      <ProductSection
        title="New Arrivals"
        products={newArrivals}
        viewAllLink="/collections/new-arrivals"
      />
    </Layout>
  );
};

export default Index;
