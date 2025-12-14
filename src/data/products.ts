import { Product, Category } from "@/types/product";

export const categories: Category[] = [
  {
    id: "1",
    name: "Gown",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop",
    slug: "gown",
  },
  {
    id: "2",
    name: "Lehenga",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&h=500&fit=crop",
    slug: "lehenga",
  },
  {
    id: "3",
    name: "Saree",
    image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&h=500&fit=crop",
    slug: "saree",
  },
  {
    id: "4",
    name: "Kurti Sets",
    image: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=400&h=500&fit=crop",
    slug: "kurti-sets",
  },
  {
    id: "5",
    name: "Ethnic Wear",
    image: "https://images.unsplash.com/photo-1609748340878-eed18e680e48?w=400&h=500&fit=crop",
    slug: "ethnic-wear",
  },
];

export const products: Product[] = [
  {
    id: "1",
    name: "Maha Space Gown",
    price: 1199,
    category: "gown",
    colors: [
      { name: "Grape", hex: "#4a1c4a", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=800&fit=crop" },
      { name: "Maroon", hex: "#800020", image: "https://images.unsplash.com/photo-1596783074918-c84cb1bd5d44?w=600&h=800&fit=crop" },
      { name: "Navy", hex: "#000080", image: "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=600&h=800&fit=crop" },
      { name: "Black", hex: "#000000", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=800&fit=crop",
      "https://images.unsplash.com/photo-1596783074918-c84cb1bd5d44?w=600&h=800&fit=crop",
      "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=600&h=800&fit=crop",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop",
    ],
    description: "Westside link in pageParty wear gown + dupatta. Fabric: space silk with full sequence work. Dupatta: space silk with full sequence work and cut work sequence embroidery lace.",
    fabric: "Space silk with full sequence work",
    length: "54-56 inches",
  },
  {
    id: "2",
    name: "Barbie Doll Frock",
    price: 899,
    category: "gown",
    colors: [
      { name: "Red", hex: "#dc143c", image: "https://images.unsplash.com/photo-1596783074918-c84cb1bd5d44?w=600&h=800&fit=crop" },
      { name: "Pink", hex: "#ff69b4", image: "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=600&h=800&fit=crop" },
      { name: "Yellow", hex: "#ffd700", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1596783074918-c84cb1bd5d44?w=600&h=800&fit=crop",
    ],
    description: "Beautiful party wear frock with elegant design.",
    isNew: true,
  },
  {
    id: "3",
    name: "Diwali Gowns",
    price: 899,
    category: "gown",
    colors: [
      { name: "Yellow", hex: "#ffd700", image: "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=600&h=800&fit=crop" },
      { name: "Orange", hex: "#ff8c00", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
    images: [
      "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=600&h=800&fit=crop",
    ],
    description: "Festive Diwali collection gown.",
  },
  {
    id: "4",
    name: "Flare Anarkali",
    price: 1299,
    originalPrice: 2499,
    discount: 56,
    category: "gown",
    colors: [
      { name: "Peach", hex: "#ffcba4", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&fit=crop" },
      { name: "Blue", hex: "#87ceeb", image: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&fit=crop",
    ],
    description: "Elegant flare anarkali for special occasions.",
  },
  {
    id: "5",
    name: "Mahima Gown",
    price: 999,
    category: "gown",
    colors: [
      { name: "Sky Blue", hex: "#87ceeb", image: "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
    images: [
      "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=600&h=800&fit=crop",
    ],
    description: "Graceful gown with intricate embroidery.",
  },
  {
    id: "6",
    name: "Netted Lehenga",
    price: 999,
    category: "lehenga",
    colors: [
      { name: "Black", hex: "#000000", image: "https://images.unsplash.com/photo-1609748340878-eed18e680e48?w=600&h=800&fit=crop" },
      { name: "Maroon", hex: "#800020", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&h=800&fit=crop" },
    ],
    sizes: ["Free Size"],
    images: [
      "https://images.unsplash.com/photo-1609748340878-eed18e680e48?w=600&h=800&fit=crop",
    ],
    description: "Stunning netted lehenga for wedding occasions.",
    isSoldOut: true,
  },
  {
    id: "7",
    name: "Onam Lehenga",
    price: 999,
    category: "lehenga",
    colors: [
      { name: "Cream", hex: "#fffdd0", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&h=800&fit=crop",
    ],
    description: "Traditional Onam special lehenga.",
  },
  {
    id: "8",
    name: "Peacock Lehenga",
    price: 2222,
    category: "lehenga",
    colors: [
      { name: "Teal", hex: "#008080", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&fit=crop" },
      { name: "Blue", hex: "#0000ff", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L"],
    images: [
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&fit=crop",
    ],
    description: "Peacock inspired designer lehenga.",
  },
  {
    id: "9",
    name: "Royal Purple Anarkali",
    price: 799,
    category: "gown",
    colors: [
      { name: "Purple", hex: "#800080", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop",
    ],
    description: "Royal purple anarkali with golden embroidery.",
    isNew: true,
  },
  {
    id: "10",
    name: "Bandhini Gown",
    price: 1299,
    category: "gown",
    colors: [
      { name: "Blue", hex: "#0000cd", image: "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=600&h=800&fit=crop" },
      { name: "Red", hex: "#dc143c", image: "https://images.unsplash.com/photo-1596783074918-c84cb1bd5d44?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L", "XL", "2XL"],
    images: [
      "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=600&h=800&fit=crop",
    ],
    description: "Traditional Bandhini print gown.",
  },
  {
    id: "11",
    name: "Stock Clearance Lehenga",
    price: 899,
    originalPrice: 1999,
    discount: 55,
    category: "lehenga",
    colors: [
      { name: "Red", hex: "#dc143c", image: "https://images.unsplash.com/photo-1596783074918-c84cb1bd5d44?w=600&h=800&fit=crop" },
    ],
    sizes: ["Free Size"],
    images: [
      "https://images.unsplash.com/photo-1596783074918-c84cb1bd5d44?w=600&h=800&fit=crop",
    ],
    description: "Limited stock lehenga at discounted price.",
    isSoldOut: true,
  },
  {
    id: "12",
    name: "Chettinadu Lehenga",
    price: 1999,
    category: "lehenga",
    colors: [
      { name: "Multi", hex: "#ff6347", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&fit=crop" },
    ],
    sizes: ["S", "M", "L"],
    images: [
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=800&fit=crop",
    ],
    description: "Authentic Chettinadu style lehenga.",
    isSoldOut: true,
  },
];
