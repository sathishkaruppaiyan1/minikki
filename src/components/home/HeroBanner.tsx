import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { useHomeBanners } from "@/hooks/useWooCommerce";
import { useHomeConfig } from "@/hooks/useHomeConfig";
import type { HomeBanner } from "@/hooks/useWooCommerce";
import type { HomeBannerItem } from "@/hooks/useHomeConfig";

/** Map a WordPress-plugin banner onto the existing Supabase banner shape. */
const fromConfig = (banner: HomeBannerItem): HomeBanner => ({
  id: banner.id,
  image_url: banner.image,
  mobile_image_url: banner.mobile_image || null,
  redirect_link: banner.link || "/collections/all",
  alt_text: banner.alt,
  is_active: true,
  display_order: banner.id,
});

interface HeroBannerProps {
  /** Which slot in the plugin config to render. Defaults to the main hero. */
  placement?: "hero" | "below_hero";
}

const HeroBanner = ({ placement = "hero" }: HeroBannerProps) => {
  const { data: supabaseBanners = [], isLoading: supabaseLoading } = useHomeBanners();
  const { data: config, isLoading: configLoading } = useHomeConfig();
  const [current, setCurrent] = useState(0);

  const configured = (config?.banners?.[placement] || []).map(fromConfig);

  // WordPress wins when it has banners for this slot. The main hero still falls
  // back to the Supabase-managed banners so nothing disappears mid-migration;
  // the below-hero slot exists only in WordPress.
  const banners = configured.length > 0
    ? configured
    : placement === "hero"
      ? supabaseBanners
      : [];

  const isLoading = configLoading || (placement === "hero" && configured.length === 0 && supabaseLoading);

  const goNext = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Auto-slide every 5 seconds when multiple banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [banners.length, goNext]);

  // Reset current if banners change
  useEffect(() => {
    if (current >= banners.length && banners.length > 0) {
      setCurrent(0);
    }
  }, [banners.length, current]);

  // The below-hero strip is purely optional: nothing configured, nothing rendered.
  if (placement === "below_hero") {
    if (isLoading || banners.length === 0) {
      return null;
    }
  } else {
    // Loading skeleton
    if (isLoading) {
      return (
        <div className="w-full aspect-[1/1] md:aspect-[4/3] lg:aspect-[4/3] bg-muted animate-pulse" />
      );
    }

    // Fallback if no banners configured anywhere
    if (banners.length === 0) {
      return (
        <div className="w-full">
            <Link to="/collections/all">
              <div className="w-full aspect-[1/1] md:aspect-[4/3] lg:aspect-[4/3] overflow-hidden">
                <img
                  src="/banner-fallback.png"
                  alt="Shop Now"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </Link>
          </div>
      );
    }
  }

  // Single banner - no controls needed
  if (banners.length === 1) {
    return (
      <div className="w-full">
        <BannerSlide banner={banners[0]} />
      </div>
    );
  }

  // Multiple banners - carousel
  return (
    <div className="w-full relative group">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {banners.map((banner) => (
            <div key={banner.id} className="w-full flex-shrink-0">
              <BannerSlide banner={banner} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={goPrev}
        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1.5 md:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Previous banner"
      >
        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
      </button>
      <button
        onClick={goNext}
        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1.5 md:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Next banner"
      >
        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* Dots indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === current ? "bg-white w-5" : "bg-white/50"
            }`}
            aria-label={`Go to banner ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

const BannerSlide = ({ banner }: { banner: HomeBanner }) => {
  const isExternal = banner.redirect_link.startsWith("http");

  const image = (
    <div className="w-full aspect-[1/1] md:aspect-[4/3] lg:aspect-[4/3] overflow-hidden">
      <picture>
        {banner.mobile_image_url && (
          <source media="(max-width: 768px)" srcSet={banner.mobile_image_url} />
        )}
        <img
          src={banner.image_url}
          alt={banner.alt_text || "Banner"}
          className="w-full h-full object-cover object-top"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
        />
      </picture>
    </div>
  );

  if (isExternal) {
    return (
      <a href={banner.redirect_link} target="_blank" rel="noopener noreferrer">
        {image}
      </a>
    );
  }

  return <Link to={banner.redirect_link}>{image}</Link>;
};

export default HeroBanner;
