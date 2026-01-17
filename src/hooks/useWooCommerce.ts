import { useQuery } from "@tanstack/react-query";
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
}

export interface CreateReviewData {
  product_id: number;
  review: string;
  reviewer: string;
  reviewer_email: string;
  rating: number;
  images?: string[]; // base64 strings
}

export const useWooCommerceProducts = (params: ProductsParams = {}) => {
  const { category, perPage = 20, page = 1, search } = params;

  return useQuery({
    queryKey: ["woocommerce-products", category, perPage, page, search],
    queryFn: async (): Promise<ProductsResponse> => {
      const queryParams = new URLSearchParams();
      if (category && category !== "all") queryParams.set("category", category);
      queryParams.set("per_page", perPage.toString());
      queryParams.set("page", page.toString());
      if (search) queryParams.set("search", search);

      const { data, error } = await supabase.functions.invoke("woocommerce-products", {
        body: null,
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Since we can't pass query params through invoke, we'll use fetch directly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-products?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    refetchOnWindowFocus: false,
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
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }

      return response.json();
    },
    staleTime: 1000 * 60 * 60, // Cache for 60 minutes
    refetchOnWindowFocus: false,
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

export const useWooCommerceProductById = (id: string) => {
  return useQuery({
    queryKey: ["woocommerce-product-id", id],
    queryFn: async (): Promise<Product | null> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/woocommerce-products?id=${id}`,
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
      return data.products?.[0] || null;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    refetchOnWindowFocus: false,
  });
};

export const useWooCommerceReviews = (productId: string | number) => {
  return useQuery({
    queryKey: ["woocommerce-reviews", productId],
    queryFn: async (): Promise<Review[]> => {
      if (!productId) return [];

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/woocommerce-reviews?product_id=${productId}`,
          {
            method: "GET",
            headers: {
              "apikey": supabaseKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          console.warn("Failed to fetch reviews, endpoint might not exist yet");
          return [];
        }

        const data = await response.json();
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
    const { data: responseData, error } = await supabase.functions.invoke("woocommerce-reviews", {
      body: data,
    });

    if (error) {
      console.error("Error submitting review:", error);
      throw error;
    }
    return responseData;
  };
};
