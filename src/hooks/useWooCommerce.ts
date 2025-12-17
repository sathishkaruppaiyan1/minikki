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
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
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
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
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
  });
};
