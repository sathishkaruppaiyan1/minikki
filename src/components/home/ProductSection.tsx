import { Link } from "react-router-dom";
import ProductCard from "@/components/product/ProductCard";
import { Product } from "@/types/product";

interface ProductSectionProps {
  title: string;
  products: Product[];
  viewAllLink?: string;
  emoji?: string;
}

const ProductSection = ({ title, products, viewAllLink, emoji }: ProductSectionProps) => {
  return (
    <section className="py-12 lg:py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-2xl lg:text-3xl font-semibold">
            {title} {emoji && <span>{emoji}</span>}
          </h2>
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-sm uppercase tracking-wider hover:text-primary transition-colors"
            >
              View All
            </Link>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductSection;
