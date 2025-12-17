export interface ProductColor {
  name: string;
  hex: string;
  image: string;
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  category: string;
  categorySlug?: string;
  colors: ProductColor[] | string[];
  sizes: string[];
  images: string[];
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
