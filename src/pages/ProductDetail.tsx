import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, Truck, Package, ShieldCheck, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { useWooCommerceProductById, useWooCommerceProducts } from "@/hooks/useWooCommerce";
import type { Product } from "@/types/product";

// Common color name to hex mapping
const colorNameToHex: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#FF0000",
  blue: "#0000FF",
  green: "#008000",
  yellow: "#FFFF00",
  purple: "#800080",
  pink: "#FFC0CB",
  orange: "#FFA500",
  brown: "#A52A2A",
  gray: "#808080",
  grey: "#808080",
  navy: "#000080",
  maroon: "#800000",
  beige: "#F5F5DC",
  cream: "#FFFDD0",
  gold: "#FFD700",
  silver: "#C0C0C0",
  wine: "#722F37",
  teal: "#008080",
  coral: "#FF7F50",
  peach: "#FFCBA4",
  lavender: "#E6E6FA",
  mint: "#98FF98",
  olive: "#808000",
  burgundy: "#800020",
  mustard: "#FFDB58",
  rust: "#B7410E",
  grape: "#6F2DA8",
};

const ProductDetail = () => {
  const { id } = useParams();
  const { data: product, isLoading, error } = useWooCommerceProductById(id || "");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>("description");
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  // Fetch recommended products from same category
  const { data: recommendedData } = useWooCommerceProducts({
    category: product?.categoryId,
    perPage: 4,
  });

  const recommendedProducts = recommendedData?.products?.filter(
    (p) => p.id !== product?.id
  ).slice(0, 4) || [];

  // Handle recently viewed products
  useEffect(() => {
    if (product) {
      const stored = localStorage.getItem("recentlyViewed");
      let viewed: Product[] = stored ? JSON.parse(stored) : [];

      // Remove current product if exists
      viewed = viewed.filter((p) => p.id !== product.id);

      // Add current product to beginning
      viewed.unshift(product);

      // Keep only last 8 products
      viewed = viewed.slice(0, 8);

      localStorage.setItem("recentlyViewed", JSON.stringify(viewed));

      // Set recently viewed excluding current product
      setRecentlyViewed(viewed.filter((p) => p.id !== product.id).slice(0, 4));
    }
  }, [product]);

  // Reset active image when color changes
  useEffect(() => {
    setActiveImage(0);
  }, [selectedColor]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-heading">Product not found</h1>
          <Link to="/" className="text-primary hover:underline mt-4 inline-block">
            Return to home
          </Link>
        </div>
      </Layout>
    );
  }

  const formatPrice = (price: number) => `Rs. ${price.toLocaleString("en-IN")}.00`;

  // Get display images based on selected color
  const getDisplayImages = (): string[] => {
    if (selectedColor && product.variationImages) {
      const variationMatch = product.variationImages.find(
        (v) => v.color.toLowerCase() === selectedColor.toLowerCase()
      );
      if (variationMatch && variationMatch.images.length > 0) {
        return variationMatch.images;
      }
    }
    return product.images?.length > 0 ? product.images : ["/placeholder.svg"];
  };

  const displayImages = getDisplayImages();

  const getColorHex = (colorName: string): string => {
    return colorNameToHex[colorName.toLowerCase()] || "#CCCCCC";
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Parse HTML description to text
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-3 border-b border-border">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            to={`/collections/${product.categorySlug}`}
            className="hover:text-foreground transition-colors capitalize"
          >
            {product.category}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
        </nav>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-[3/4] overflow-hidden bg-muted relative">
              <img
                src={displayImages[activeImage] || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {selectedColor && (
                <span className="absolute top-4 left-4 bg-[#8B4B6B] text-white text-sm px-4 py-2 font-medium capitalize">
                  {selectedColor} Color
                </span>
              )}
              {!selectedColor && product.discount && (
                <span className="absolute top-4 left-4 bg-primary text-primary-foreground text-sm px-4 py-2 font-medium">
                  -{product.discount}%
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {displayImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveImage(index)}
                    className={`flex-shrink-0 w-16 h-20 border-2 transition-all overflow-hidden ${
                      activeImage === index
                        ? "border-foreground"
                        : "border-transparent hover:border-muted-foreground"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title & Price */}
            <div>
              <h1 className="font-heading text-2xl lg:text-3xl font-semibold text-foreground">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xl font-medium">{formatPrice(product.price)}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-muted-foreground line-through text-lg">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>
            </div>

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-3">
                  Color{selectedColor && <span className="capitalize">: {selectedColor}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color, index) => {
                    const colorName = typeof color === "string" ? color : color.name;
                    const colorHex = typeof color === "string" ? getColorHex(color) : color.hex;
                    const isSelected = selectedColor?.toLowerCase() === colorName.toLowerCase();
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedColor(isSelected ? null : colorName)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          isSelected
                            ? "ring-2 ring-foreground ring-offset-2 border-foreground"
                            : "border-border hover:border-foreground"
                        }`}
                        style={{ backgroundColor: colorHex }}
                        title={colorName}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {product.sizes.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-3">Size</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`min-w-[50px] h-10 px-4 rounded-full border text-sm font-medium transition-all ${
                        selectedSize === size
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground bg-background"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stitching Requirement (Optional - show if applicable) */}
            <div className="flex items-center justify-between py-3 border border-border rounded px-4">
              <span className="text-sm">Available: In SL Stitching Requirement Type</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Add to Cart Button */}
            <Button
              className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-none text-base font-medium"
              disabled={product.isSoldOut}
            >
              {product.isSoldOut ? "SOLD OUT" : "ADD TO CART"}
            </Button>

            {/* Accordion Sections */}
            <div className="border-t border-border">
              {/* Description */}
              <div className="border-b border-border">
                <button
                  onClick={() => toggleSection("description")}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <span className="font-medium">Product Details</span>
                  {expandedSection === "description" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedSection === "description" && (
                  <div className="pb-4 text-sm text-muted-foreground leading-relaxed">
                    {product.shortDescription && (
                      <p className="mb-2">{stripHtml(product.shortDescription)}</p>
                    )}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: product.description || "No description available.",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Shipping & Returns */}
              <div className="border-b border-border">
                <button
                  onClick={() => toggleSection("shipping")}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <span className="font-medium">Shipping & Returns</span>
                  {expandedSection === "shipping" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedSection === "shipping" && (
                  <div className="pb-4 text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>Free shipping on all orders across India.</p>
                    <p>Delivery time: 15-20 working days</p>
                    <p>Easy returns within 7 days of delivery.</p>
                  </div>
                )}
              </div>

              {/* Size & Fit */}
              <div className="border-b border-border">
                <button
                  onClick={() => toggleSection("size")}
                  className="w-full flex items-center justify-between py-4 text-left"
                >
                  <span className="font-medium">Size & Fit</span>
                  {expandedSection === "size" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedSection === "size" && (
                  <div className="pb-4 text-sm text-muted-foreground leading-relaxed space-y-2">
                    <p>Available sizes: S, M, L, XL, XXL, XXXL, 4XL, 5XL</p>
                    <p>For size guidance, please refer to our size chart.</p>
                    <p>Full lining available (inside)</p>
                    <p>Best quality and best stitching</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 py-8 border-t border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-sm">Safe Payment</p>
              <p className="text-xs text-muted-foreground">
                Pay with the world's most payment methods
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-sm">Buy With Confidence</p>
              <p className="text-xs text-muted-foreground">GST & MSME Registered brand</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-sm">Fast Delivery</p>
              <p className="text-xs text-muted-foreground">
                FREE SHIPPING to All Over India
              </p>
            </div>
          </div>
        </div>

        {/* Recommended Products */}
        {recommendedProducts.length > 0 && (
          <section className="mt-12">
            <h2 className="font-heading text-2xl font-semibold text-center mb-8">
              Recommended Products
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              {recommendedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <section className="mt-12 mb-8">
            <h2 className="font-heading text-2xl font-semibold text-center mb-8">
              Recently Viewed
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
              {recentlyViewed.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default ProductDetail;
