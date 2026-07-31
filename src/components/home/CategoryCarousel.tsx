import { useWooCommerceCategories } from "@/hooks/useWooCommerce";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

// Static category list with continuous sword-shine effect
const CategoryCarousel = () => {
  const { data, isLoading } = useWooCommerceCategories();
  const categories = data?.categories || [];

  if (isLoading) {
    return (
      <section className="bg-background border-b border-border/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 shrink-0"
              >
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
      <div className="container mx-auto px-4 py-4 overflow-hidden">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/collections/${category.slug}`}
              className="group flex flex-col items-center gap-2 shrink-0"
            >
              {/* Category Image with Gradient Ring */}
              <div className="category-shine">
                <div className="category-shine-inner">
                  <img
                    src={category.image}
                    alt={category.name}
                    loading="lazy"
                    decoding="async"
                    className="category-image"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;

                      if (target.src !== "/placeholder.svg") {
                        target.src = "/placeholder.svg";
                      }
                    }}
                  />

                  {/* Sword Shine Effect */}
                  <span
                    className="category-shine-effect"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Category Name */}
              <span className="max-w-[72px] sm:max-w-[88px] truncate text-center text-xs sm:text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .category-shine {
          --sc-border-color-1: #f09433;
          --sc-border-color-2: #e1306c;
          --sc-border-color-3: #833ab4;

          position: relative;
          width: 4rem;
          height: 4rem;
          padding: 2px;
          border-radius: 50%;

          background: linear-gradient(
            135deg,
            var(--sc-border-color-1),
            var(--sc-border-color-2),
            var(--sc-border-color-3)
          );

          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);

          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease;

          overflow: hidden;
          isolation: isolate;
        }

        @media (min-width: 640px) {
          .category-shine {
            width: 5rem;
            height: 5rem;
          }
        }

        @media (min-width: 1024px) {
          .category-shine {
            width: 6rem;
            height: 6rem;
          }
        }

        .group:hover .category-shine {
          transform: translateY(-2px);
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.15),
            0 0 10px rgba(225, 48, 108, 0.25);
        }

        .category-shine-inner {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          overflow: hidden;
          background: #ffffff;
        }

        .category-image {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;

          transition: transform 0.5s ease;
        }

        .group:hover .category-image {
          transform: scale(1.1);
        }

        .category-shine-effect {
          position: absolute;
          top: -60%;
          left: -120%;

          width: 40%;
          height: 220%;

          pointer-events: none;
          z-index: 2;

          background: linear-gradient(
            115deg,
            transparent 0%,
            transparent 35%,
            rgba(255, 255, 255, 0.1) 43%,
            rgba(255, 255, 255, 0.5) 48%,
            rgba(255, 255, 255, 0.95) 50%,
            rgba(255, 255, 255, 0.5) 52%,
            rgba(255, 255, 255, 0.1) 57%,
            transparent 65%,
            transparent 100%
          );

          transform: rotate(15deg) translateX(-250%);
          filter: blur(1px);

          animation: swordShine 3.5s ease-in-out infinite;
        }

        @keyframes swordShine {
          0% {
            transform: rotate(15deg) translateX(-250%);
            opacity: 0;
          }

          8% {
            opacity: 1;
          }

          45% {
            opacity: 1;
          }

          60% {
            transform: rotate(15deg) translateX(500%);
            opacity: 0;
          }

          100% {
            transform: rotate(15deg) translateX(500%);
            opacity: 0;
          }
        }

        .no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
          
        @media (prefers-reduced-motion: reduce) {
          .category-shine-effect {
            animation: none;
          }

          .category-image {
            transition: none;
          }

          .category-shine {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
};

export default CategoryCarousel;