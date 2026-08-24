import Layout from "@/components/layout/Layout";

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
  const { data: config } = useHomeConfig();

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
      <HeroBanner />

      {/* Optional banner strip below the hero, managed in WordPress */}
      <HeroBanner placement="below_hero" />

      {sections.map((section, index) => (
        <HomeProductRow
          key={section.id || `section-${index}`}
          section={section}
          priority={index === 0}
        />
      ))}

      <ReviewsSlider />

      <StorySection />
    </Layout>
  );
};

export default Index;
