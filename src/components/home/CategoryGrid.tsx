import { Link } from "react-router-dom";
import { useWooCommerceCategories } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/ui/Reveal";

const CategoryGrid = () => {
  const { data, isLoading, error } = useWooCommerceCategories();
  const categories = data?.categories || [];

  if (error) {
    console.error("CategoryGrid error:", error);
  }

  if (isLoading) {
    return (
      <section className="pt-4 pb-12 lg:pb-16">
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
    <section className="pb-12 lg:pb-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="font-heading text-2xl lg:text-3xl font-semibold text-center mb-8">
          Shop By Category
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              to={`/collections/${category.slug}`}
              className="group animate-fade-in block h-full"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Reveal className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-card transition-all duration-300 group-hover:shadow-card-hover group-hover:-translate-y-1">
                <img
                  src={category.image}
                  alt={category.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== "/placeholder.svg") {
                      target.src = "/placeholder.svg";
                    }
                  }}
                />

                {/* Espresso gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--surface-dark))]/90 via-[hsl(var(--surface-dark))]/25 to-transparent" />

                {/* Gold frame on hover */}
                <div className="absolute inset-2 rounded-xl border border-primary/0 group-hover:border-primary/70 transition-colors duration-300 pointer-events-none" />

                {/* Name + CTA */}
                <div className="absolute inset-x-0 bottom-0 p-3 lg:p-4 text-center">
                  <span className="block mx-auto mb-2 h-0.5 w-8 bg-primary rounded-full transition-all duration-300 group-hover:w-14" />
                  <h3 className="font-heading text-lg lg:text-xl font-semibold text-[hsl(var(--surface-dark-foreground))] leading-tight">
                    {category.name}
                  </h3>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-primary mt-1 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    Shop Now
                  </span>
                </div>
              </Reveal>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;
