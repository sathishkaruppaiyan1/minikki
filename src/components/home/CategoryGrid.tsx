import { Link } from "react-router-dom";
import { useWooCommerceCategories } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";

const CategoryGrid = () => {
  const { data, isLoading } = useWooCommerceCategories();
  const categories = data?.categories || [];

  if (isLoading) {
    return (
      <section className="py-12 lg:py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-2xl lg:text-3xl font-semibold text-center mb-8">
            Shop By Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-12 lg:py-16">
      <div className="container mx-auto px-4">
        <h2 className="font-heading text-2xl lg:text-3xl font-semibold text-center mb-8">
          Shop By Category
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              to={`/collections/${category.slug}`}
              className="group animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-foreground/20 group-hover:bg-foreground/30 transition-colors" />
              </div>
              <h3 className="text-center mt-3 font-medium text-sm lg:text-base group-hover:text-primary transition-colors">
                {category.name}
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;
