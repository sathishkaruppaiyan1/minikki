import { useQuery } from "@tanstack/react-query";

/**
 * Homepage configuration served by the "Minikki Home Builder" WordPress plugin
 * (GET /wp-json/minikki/v1/home).
 *
 * Every consumer must treat this as optional: when the plugin is not installed,
 * disabled, or unreachable, the query resolves to `null` and each section falls
 * back to the behaviour it had before the plugin existed.
 */

export interface HomeTopbarMessage {
  text: string;
  link: string;
}

export interface HomeTopbar {
  enabled: boolean;
  mode: "scroll" | "static";
  speed: number;
  background: string;
  color: string;
  messages: HomeTopbarMessage[];
}

export interface HomeCategoryItem {
  id: string;
  name: string;
  slug: string;
  image: string;
  link: string;
  count: number;
}

export interface HomeCategorySection {
  enabled: boolean;
  source: "auto" | "manual";
  title?: string;
  items: HomeCategoryItem[];
}

export interface HomeBannerItem {
  id: number;
  image: string;
  mobile_image: string;
  link: string;
  alt: string;
}

export interface HomeProductSection {
  enabled: boolean;
  title: string;
  view_all_link: string;
  source: "tag" | "manual";
  tag: string;
  product_ids: number[];
}

export interface HomeReviewItem {
  id: number;
  name: string;
  text: string;
  rating: number;
  image: string;
  link: string;
}

export interface HomeReviewSection {
  enabled: boolean;
  title: string;
  subtitle: string;
  items: HomeReviewItem[];
}

export interface HomeMenuItem {
  id: number;
  label: string;
  link: string;
  /** Item kind. WordPress nav menus report their own types (taxonomy, post_type, custom…). */
  type: string;
  /** Parent menu item id for nested WordPress menus; 0 or absent for top level. */
  parent?: number;
}

export interface HomeMobileMenu {
  enabled: boolean;
  title: string;
  source: "wp_menu" | "auto" | "manual";
  items: HomeMenuItem[];
}

export interface HomeConfig {
  version: string;
  updated_at: number;
  topbar: HomeTopbar;
  circle_categories: HomeCategorySection;
  shop_by_category: HomeCategorySection;
  banners: {
    hero: HomeBannerItem[];
    below_hero: HomeBannerItem[];
  };
  new_arrivals: HomeProductSection;
  hot_sellers: HomeProductSection;
  reviews: HomeReviewSection;
  mobile_menu: HomeMobileMenu;
}

const getEndpoint = (): string | null => {
  const wpUrl = import.meta.env.VITE_WORDPRESS_URL as string | undefined;

  if (!wpUrl) return null;

  return `${wpUrl.replace(/\/+$/, "")}/wp-json/minikki/v1/home`;
};

export const useHomeConfig = () => {
  const endpoint = getEndpoint();

  return useQuery({
    queryKey: ["minikki-home-config"],
    enabled: !!endpoint,
    queryFn: async (): Promise<HomeConfig | null> => {
      if (!endpoint) return null;

      try {
        // No custom headers on purpose: this stays a CORS "simple request", so
        // browsers skip the preflight round-trip on every page load.
        const response = await fetch(endpoint, { method: "GET" });

        // 404 = plugin not installed yet. That is a supported state, not an error.
        if (!response.ok) {
          console.warn(`Home config unavailable (${response.status}) — using built-in defaults.`);
          return null;
        }

        return (await response.json()) as HomeConfig;
      } catch (error) {
        console.warn("Home config fetch failed — using built-in defaults.", error);
        return null;
      }
    },
    staleTime: 1000 * 60, // 1 min - matches the endpoint's Cache-Control
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
