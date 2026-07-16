import { Link } from "react-router-dom";
import { useWooCommerceCategories } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";

// Horizontal, round-image category slider shown above the hero banner.
const CategoryCarousel = () => {
  const { data, isLoading } = useWooCommerceCategories();
  const categories = data?.categories || [];

  if (isLoading) {
    return (
      <section className="bg-background border-b border-border/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-full" />
                <Skeleton className="h-3 w-14" />
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
    <section className="bg-background border-b border-border/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar snap-x scroll-px-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              to={`/collections/${category.slug}`}
              className="group flex flex-col items-center gap-2 shrink-0 snap-start animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-full overflow-hidden border-2 border-border shadow-sm transition-all duration-300 group-hover:border-primary group-hover:shadow-md">
                <img
                  src={category.image}
                  alt={category.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== "/placeholder.svg") {
                      target.src = "/placeholder.svg";
                    }
                  }}
                />
              </div>
              <span className="max-w-[72px] sm:max-w-[88px] truncate text-center text-xs sm:text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryCarousel;
