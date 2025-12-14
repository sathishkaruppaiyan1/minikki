export interface ProductColor {
  name: string;
  hex: string;
  image: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  colors: ProductColor[];
  sizes: string[];
  images: string[];
  description: string;
  fabric?: string;
  length?: string;
  isNew?: boolean;
  isSoldOut?: boolean;
  discount?: number;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  slug: string;
}
