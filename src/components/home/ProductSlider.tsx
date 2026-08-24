import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { Product } from "@/types/product";
import { getProductCardImage } from "@/lib/imageOptimizer";
import { getProductPriceDetails } from "@/lib/utils";

interface ProductSliderProps {
  title: string;
  products: Product[];
  viewAllLink?: string;
}

// Autoplay cadence mirrors the reference carousel: a slide every 2s.
const AUTOPLAY_DELAY = 2000;

const formatPrice = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SliderCard = ({ product }: { product: Product }) => {
  const price = useMemo(
    () => getProductPriceDetails(product.price, product.originalPrice),
    [product.price, product.originalPrice]
  );

  const image = useMemo(() => {
    const raw = product.images[0] || "/placeholder.svg";
    return raw.startsWith("/") || raw.startsWith("data:") ? raw : getProductCardImage(raw);
  }, [product.images]);

  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative block overflow-hidden rounded-[10px] border-[0.8px] border-[#eeeeee] bg-background"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== "/placeholder.svg") target.src = "/placeholder.svg";
          }}
        />

        {product.isSoldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-[#f5333f] px-3 py-1 text-xs font-semibold text-white">
            Sold Out
          </span>
        )}

        {/* Scrim + details reveal on hover, as on the reference carousel */}
        <div className="absolute inset-0 bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <h3 className="mb-2.5 line-clamp-2 text-base font-medium leading-snug text-white">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-white">
              {formatPrice(price.offerPrice)}
            </span>
            {price.discountPercentage > 0 && (
              <span className="text-sm text-white/70 line-through">
                {formatPrice(price.actualPrice)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

const ProductSlider = ({ title, products, viewAllLink }: ProductSliderProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    duration: 35,
    containScroll: "trimSnaps",
  });

  // Autoplay runs unattended (no pause on hover), matching the reference.
  useEffect(() => {
    if (!emblaApi) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      emblaApi.scrollNext();
    }, AUTOPLAY_DELAY);

    return () => window.clearInterval(timer);
  }, [emblaApi]);

  if (products.length === 0) return null;

  return (
    <section className="py-10 lg:py-16">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between gap-4 lg:mb-8">
          <div className="flex items-center gap-5">
            <h2 className="font-heading text-3xl font-medium leading-none text-foreground lg:text-[50px]">
              {title}
            </h2>
            <span className="hidden h-9 w-px bg-border sm:block lg:h-14" />
          </div>

          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="shrink-0 rounded-full border border-primary px-5 py-2.5 text-sm text-primary transition-colors hover:bg-primary hover:text-primary-foreground lg:px-6"
            >
              Explore More
            </Link>
          )}
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="-ml-[10px] flex touch-pan-y">
            {products.map((product, index) => (
              <div
                key={`${product.id}-${index}`}
                className="min-w-0 shrink-0 grow-0 basis-full pl-[10px] md:basis-1/2 lg:basis-1/3 [@media(min-width:1366px)]:basis-1/4"
              >
                <SliderCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductSlider;
