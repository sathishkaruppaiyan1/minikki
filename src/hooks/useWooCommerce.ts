import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Category } from "@/types/product";

interface ProductsResponse {
  products: Product[];
  total: number;
  totalPages: number;
  currentPage: number;
}

interface CategoriesResponse {
  categories: Category[];
}

interface ProductsParams {
  category?: string;
  perPage?: number;
  page?: number;
  search?: string;
  skipVariations?: boolean; // Skip variation processing for faster list views
  enabled?: boolean; // Whether to enable the query
}

export interface Review {
  id: number;
  date_created: string;
  reviewer: string;
  reviewer_email: string;
  review: string;
  rating: number;
  verified: boolean;
  reviewer_avatar_urls: Record<string, string>;
  media?: string[]; // URLs to images/videos stored in Supabase
}

export interface CreateReviewData {
  product_id: number;
  review: string;
  reviewer: string;
  reviewer_email: string;
  rating: number;
  images?: string[]; // base64 strings
}

export interface OrderLineItem {
  product_id: number;
  variation_id?: number;
  quantity: number;
}

export interface CreateOrderData {
  payment_method: string;
  payment_method_title: string;
  set_paid: boolean;
  billing: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: OrderLineItem[];
  meta_data?: {
    key: string;
    value: string;
  }[];
}

export const useWooCommerceProducts = (params: ProductsParams = {}) => {
  const { category, perPage = 20, page = 1, search, skipVariations = false, enabled = true } = params;

  return useQuery({
    queryKey: ["woocommerce-products", category, perPage, page, search, skipVariations],
    enabled,
    queryFn: async (): Promise<ProductsResponse> => {
      const queryParams = new URLSearchParams();
      if (category && category !== "all") queryParams.set("category", category);
      queryParams.set("per_page", perPage.toString());
      queryParams.set("page", page.toString());
      if (search) queryParams.set("search", search);
      if (skipVariations) queryParams.set("skip_variations", "true"); // Skip variations for faster loading

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-products?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Products fetch error:", response.status, errorText);
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const jsonData = await response.json();
      return jsonData;
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    refetchOnWindowFocus: false,
    // Enable parallel queries and better caching
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour (formerly cacheTime)
    // Prefetch and cache aggressively for better performance
    refetchOnMount: false, // Use cached data if available
    // Show data immediately when available - don't wait for full fetch
    placeholderData: (previousData) => previousData,
    // Return data immediately, don't wait for background refetch
    notifyOnChangeProps: ['data', 'error'],
  });
};

// Infinite scroll hook for progressive loading
export const useWooCommerceProductsInfinite = (params: Omit<ProductsParams, 'page'> = {}) => {
  const { category, perPage = 12, search, skipVariations = false } = params;

  return useInfiniteQuery({
    queryKey: ["woocommerce-products-infinite", category, perPage, search, skipVariations],
    queryFn: async ({ pageParam = 1 }): Promise<ProductsResponse> => {
      const queryParams = new URLSearchParams();
      if (category && category !== "all") queryParams.set("category", category);
      queryParams.set("per_page", perPage.toString());
      queryParams.set("page", pageParam.toString());
      if (search) queryParams.set("search", search);
      if (skipVariations) queryParams.set("skip_variations", "true");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-products?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Products fetch error:", response.status, errorText);
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      return response.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we have more pages, return next page number
      if (lastPage.currentPage < lastPage.totalPages) {
        return lastPage.currentPage + 1;
      }
      return undefined; // No more pages
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    gcTime: 1000 * 60 * 60,
    refetchOnMount: false,
  });
};

export const useWooCommerceCategories = () => {
  return useQuery({
    queryKey: ["woocommerce-categories"],
    queryFn: async (): Promise<CategoriesResponse> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-categories`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Categories fetch error:", response.status, errorText);
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 60, // Cache for 60 minutes
    refetchOnWindowFocus: false,
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnMount: false, // Use cached data if available
  });
};

export const useWooCommerceProduct = (slug: string) => {
  return useQuery({
    queryKey: ["woocommerce-product", slug],
    queryFn: async (): Promise<Product | null> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-products?search=${encodeURIComponent(slug)}&per_page=1`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch product");
      }

      const data = await response.json();
      return data.products?.find((p: Product) => p.slug === slug) || null;
    },
    enabled: !!slug,
  });
};

export interface PaymentGateway {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  order: number;
}

export const useWooCommercePaymentGateways = () => {
  return useQuery({
    queryKey: ["woocommerce-payment-gateways"],
    queryFn: async (): Promise<PaymentGateway[]> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/woocommerce-payment-gateways`,
          {
            method: "GET",
            headers: {
              "apikey": supabaseKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch payment gateways");
        }

        const data = await response.json();
        return data.gateways || [];
      } catch (error) {
        console.error("Error fetching payment gateways:", error);
        // Return default payment methods if API fails
        return [
          {
            id: "cod",
            title: "Cash on Delivery (COD)",
            description: "Pay when you receive your order",
            enabled: true,
            order: 1,
          },
          {
            id: "razorpay",
            title: "Online Payment",
            description: "UPI, Cards, Net Banking, Wallets",
            enabled: true,
            order: 2,
          },
        ];
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 60 minutes
    refetchOnWindowFocus: false,
  });
};

// Fast initial product load (basic data + main variation images, no gallery)
export const useWooCommerceProductById = (id: string) => {
  return useQuery({
    queryKey: ["woocommerce-product-id-fast", id],
    queryFn: async (): Promise<Product | null> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Use skip_variations=true for fast initial load (gets basic variation images)
      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-products?id=${id}&skip_variations=true`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Product fetch error:", response.status, errorText);
        throw new Error(`Failed to fetch product: ${response.status}`);
      }

      const data = await response.json();
      return data.products?.[0] || null;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
};

// Background load for full variation gallery images
export const useWooCommerceProductGallery = (id: string, productType?: string) => {
  return useQuery({
    queryKey: ["woocommerce-product-gallery", id],
    queryFn: async (): Promise<Product | null> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Full load with all variation gallery images
      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-products?id=${id}`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Product gallery fetch error:", response.status, errorText);
        throw new Error(`Failed to fetch product gallery: ${response.status}`);
      }

      const data = await response.json();
      return data.products?.[0] || null;
    },
    // Only fetch gallery for variable products
    enabled: !!id && productType === 'variable',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

export const useWooCommerceReviews = (productId: string | number) => {
  return useQuery({
    queryKey: ["woocommerce-reviews", productId],
    queryFn: async (): Promise<Review[]> => {
      if (!productId) return [];

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      console.log("Fetching reviews for product:", productId);

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/woocommerce-reviews?product_id=${productId}`,
          {
            method: "GET",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to fetch reviews:", response.status, errorText);
          return [];
        }

        const data = await response.json();
        console.log("Reviews response:", data);
        return data.reviews || [];
      } catch (error) {
        console.error("Error fetching reviews:", error);
        return [];
      }
    },
    enabled: !!productId,
  });
};

export const useSubmitWooCommerceReview = () => {
  return async (data: CreateReviewData) => {
    console.log("Submitting review with data:", {
      product_id: data.product_id,
      reviewer: data.reviewer,
      rating: data.rating,
      imagesCount: data.images?.length || 0
    });

    const { data: responseData, error } = await supabase.functions.invoke("woocommerce-reviews", {
      body: data,
    });

    if (error) {
      console.error("Error submitting review:", error);
      throw error;
    }

    console.log("Review submission response:", responseData);
    return responseData;
  };
};

export const useCreateOrder = () => {
  return async (orderData: CreateOrderData) => {
    console.log("Creating order with data:", orderData);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-orders`,
        {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Order creation failed:", response.status, errorText);
        throw new Error(`Failed to create order: ${response.status} ${errorText}`);
      }

      const responseData = await response.json();
      console.log("Order creation response:", responseData);
      return responseData;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  };
};

// WordPress Pages
export interface WordPressPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  date: string;
  modified: string;
  featuredImage: string | null;
}

export const useWordPressPage = (slug: string) => {
  return useQuery({
    queryKey: ["wordpress-page", slug],
    queryFn: async (): Promise<WordPressPage | null> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-pages?slug=${encodeURIComponent(slug)}`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Page fetch error:", response.status, errorText);
        throw new Error(`Failed to fetch page: ${response.status}`);
      }

      const data = await response.json();
      return data.pages?.[0] || null;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

export const useWordPressPages = () => {
  return useQuery({
    queryKey: ["wordpress-pages"],
    queryFn: async (): Promise<WordPressPage[]> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-pages`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Pages fetch error:", response.status, errorText);
        throw new Error(`Failed to fetch pages: ${response.status}`);
      }

      const data = await response.json();
      return data.pages || [];
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
