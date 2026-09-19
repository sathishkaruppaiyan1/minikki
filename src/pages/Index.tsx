import Layout from "@/components/layout/Layout";

import CategoryCarousel from "@/components/home/CategoryCarousel";
import HeroBanner from "@/components/home/HeroBanner";
import HomeProductRow from "@/components/home/HomeProductRow";
import ReviewsSlider from "@/components/home/ReviewsSlider";
import StorySection from "@/components/home/StorySection";
import { useHomeConfig } from "@/hooks/useHomeConfig";
import type { HomeProductSection } from "@/hooks/useHomeConfig";

/**
 * Rows shown when the WordPress plugin is absent or has not been saved yet, so
 * the homepage looks the same with or without it.
 */
const FALLBACK_SECTIONS: HomeProductSection[] = [
  {
    id: "new_arrivals",
    enabled: true,
    title: "New Arrivals",
    view_all_link: "/collections/all",
    layout: "slider",
    source: "tag",
    tag: "new-arrivals",
    category_slug: "",
    category_id: 0,
    product_ids: [],
    limit: 12,
  },
  {
    id: "hot_sellers",
    enabled: true,
    title: "Hot Sellers",
    view_all_link: "/collections/all",
    layout: "slider",
    source: "tag",
    tag: "hot-sellers",
    category_slug: "",
    category_id: 0,
    product_ids: [],
    limit: 12,
  },
];

const Index = () => {
  const { data: config, isLoading: configLoading } = useHomeConfig();

  // Homepage rows are cached until this changes. It has to cover both "the
  // carousel was edited" (updated_at) and "a price moved" (catalog_updated_at),
  // because desktop cards reveal the price on hover and would otherwise keep
  // showing a stale one indefinitely.
  //
  // Stays undefined until the config request settles, which holds the rows back
  // from fetching. Without that they would fetch once against the fallback
  // sections and again under the real version — two round trips and a content
  // flash. A null config (WordPress unreachable) still resolves to 0, so the
  // fallback rows do load.
  const configVersion = configLoading
    ? undefined
    : Math.max(config?.updated_at || 0, config?.catalog_updated_at || 0);

  // `sections` is the current shape; fall back to the legacy pair, then to the
  // hardcoded defaults, so older plugin versions keep working.
  const sections: HomeProductSection[] =
    config?.sections && config.sections.length > 0
      ? config.sections
      : config?.new_arrivals || config?.hot_sellers
        ? ([config.new_arrivals, config.hot_sellers].filter(Boolean) as HomeProductSection[]).map(
            (section, index) => ({
              ...FALLBACK_SECTIONS[index],
              ...section,
            })
          )
        : FALLBACK_SECTIONS;

  return (
    <Layout>
      {/* Story-style category strip directly under the header. Selection,
          order and visibility come from the WordPress plugin. */}
      <CategoryCarousel />

      <HeroBanner />

      {/* Optional banner strip below the hero, managed in WordPress */}
      <HeroBanner placement="below_hero" />

      {/* configVersion pins each row's product data to the WordPress config.
          Rows are then fetched once per visitor per edit instead of on a timer;
          saving the Home Builder changes updated_at and invalidates them. */}
      {sections.map((section, index) => (
        <HomeProductRow
          key={section.id || `section-${index}`}
          section={section}
          priority={index === 0}
          configVersion={configVersion}
        />
      ))}

      <ReviewsSlider />

      <StorySection />
    </Layout>
  );
};

export default Index;
