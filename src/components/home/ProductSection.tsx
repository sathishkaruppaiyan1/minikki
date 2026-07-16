import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "@/components/product/ProductCard";
import { Product } from "@/types/product";

interface ProductSectionProps {
  title: string;
  products: Product[];
  viewAllLink?: string;
  emoji?: string;
}

// Types the title in when the section scrolls into view, with a blinking gold caret.
const TypedTitle = ({ text }: { text: string }) => {
  const ref = useRef<HTMLHeadingElement>(null);
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }

    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.9 && r.bottom > 0;
    };

    if (inView()) {
      setStarted(true);
      return;
    }

    let obs: IntersectionObserver | null = null;
    const trigger = () => {
      setStarted(true);
      obs?.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    // Scroll fallback alongside the observer — some environments starve IO callbacks
    const onScroll = () => {
      if (inView()) trigger();
    };

    if (typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) trigger();
      });
      obs.observe(el);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      obs?.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [text.length]);

  useEffect(() => {
    if (!started || count >= text.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), 70);
    return () => clearTimeout(t);
  }, [started, count, text.length]);

  const done = count >= text.length;

  return (
    <h2
      ref={ref}
      className="font-heading text-2xl lg:text-4xl font-semibold text-foreground"
    >
      {text.slice(0, count)}
      <span
        className={`inline-block w-0.5 h-[0.9em] bg-primary align-[-0.1em] ml-1 animate-pulse transition-opacity duration-500 ${done ? "opacity-0" : "opacity-100"}`}
      />
    </h2>
  );
};

const ProductSection = ({ title, products, viewAllLink, emoji }: ProductSectionProps) => {
  return (
    <section className="py-10 lg:py-20 border-b border-border/40 last:border-0">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4 mb-6 lg:mb-8">
          <div className="flex items-center gap-2">
            <TypedTitle text={title} />
            {emoji && <span className="text-2xl lg:text-4xl">{emoji}</span>}
          </div>

          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="shrink-0 inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2 lg:px-6 text-xs lg:text-sm font-bold uppercase tracking-wider rounded-xl shadow-btn hover:bg-primary/90 transition-colors"
            >
              View All
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {products.map((product, index) => (
            <ProductCard key={`${product.id}-${index}`} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductSection;
