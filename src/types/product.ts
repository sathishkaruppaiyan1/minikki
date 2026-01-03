export interface ProductColor {
  name: string;
  hex: string;
  image: string;
}

export interface VariationImages {
  color: string;
  images: string[];
  attributes?: {
    id: number;
    name: string;
    option: string;
  }[];
  id?: number;
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  category: string;
  categorySlug?: string;
  categoryId?: string;
  colors: ProductColor[] | string[];
  sizes: string[];
  images: string[];
  variationImages?: VariationImages[];
  description: string;
  shortDescription?: string;
  fabric?: string;
  length?: string;
  isNew?: boolean;
  isSoldOut?: boolean;
  inStock?: boolean;
  discount?: number;
  sku?: string;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  slug: string;
}
