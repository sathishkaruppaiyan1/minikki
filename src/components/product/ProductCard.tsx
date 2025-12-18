import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Product, ProductColor } from "@/types/product";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useQuickView } from "@/contexts/QuickViewContext";

// Adorn Icons
const AdornHeart = ({ filled }: { filled?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
    <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornBag = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 6H21L19 16H8L6 6Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="17" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface ProductCardProps {
  product: Product;
}

// Helper to check if color is ProductColor object or string
const isProductColor = (color: ProductColor | string): color is ProductColor => {
  return typeof color === "object" && "hex" in color;
};

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
  cyan: "#00FFFF",
  magenta: "#FF00FF",
};

const getColorHex = (color: ProductColor | string): string => {
  if (isProductColor(color)) return color.hex;
  const colorLower = color.toLowerCase();
  return colorNameToHex[colorLower] || "#CCCCCC";
};

const getColorName = (color: ProductColor | string): string => {
  if (isProductColor(color)) return color.name;
  return color;
};

const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { openQuickView } = useQuickView();
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.colors && product.colors.length > 0
      ? (typeof product.colors[0] === "string" ? product.colors[0] : product.colors[0].name)
      : null
  );

  const formatPrice = (price: number) => {
    return `Rs. ${price.toLocaleString("en-IN")}`;
  };

  const inWishlist = isInWishlist(product.id);

  // Get current display image based on selected color
  const getCurrentImage = (): string => {
    if (selectedColor && product.variationImages) {
      const variationMatch = product.variationImages.find(
        (v) => v.color.toLowerCase() === selectedColor.toLowerCase()
      );
      if (variationMatch && variationMatch.images.length > 0) {
        return variationMatch.images[0];
      }
    }
    return product.images[0] || "/placeholder.svg";
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Default to first size if available, or just add product
    const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : undefined;
    addToCart(product, 1, size, selectedColor || undefined);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openQuickView(product);
  };

  return (
    <div className="group animate-fade-in">
      <div className="relative overflow-hidden bg-muted aspect-[3/4]">
        <Link to={`/product/${product.id}`}>
          <img
            src={getCurrentImage()}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.discount && (
            <span className="badge-sale text-xs px-2 py-1 font-bold">
              -{product.discount}%
            </span>
          )}
          {product.isNew && (
            <span className="badge-new text-xs px-2 py-1 font-bold">
              New
            </span>
          )}
          {product.isSoldOut && (
            <span className="badge-soldout text-xs px-2 py-1 font-bold">
              Sold out
            </span>
          )}
        </div>

        {/* Action buttons - hidden on mobile for Cart, visible on hover desktop */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Button
            variant="icon"
            size="iconSm"
            className={`bg-background/90 hover:bg-background shadow-sm ${inWishlist ? "text-primary" : ""}`}
            onClick={handleWishlist}
          >
            <AdornHeart filled={inWishlist} />
          </Button>
          <Button
            variant="icon"
            size="iconSm"
            className="bg-background/90 hover:bg-background shadow-sm"
            onClick={handleQuickView}
          >
            <AdornEye />
          </Button>
          <Button
            variant="icon"
            size="iconSm"
            className="hidden md:inline-flex bg-background/90 hover:bg-background shadow-sm"
            onClick={handleAddToCart}
            disabled={product.isSoldOut}
          >
            <AdornBag />
          </Button>
        </div>

        {/* Add to Cart on hover - bottom (hidden on mobile, visible on desktop hover) */}
        <div className="hidden md:block absolute bottom-0 left-0 right-0 bg-foreground text-background py-3 text-center font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={handleAddToCart}
        >
          {product.isSoldOut ? "SOLD OUT" : "ADD TO CART"}
        </div>
      </div>

      {/* Product info */}
      <div className="mt-3 space-y-2">
        <Link to={`/product/${product.id}`}>
          <h3 className="text-sm font-bold hover:text-primary transition-colors line-clamp-1">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center flex-wrap gap-2">
          <span className="price text-sm font-bold">{formatPrice(product.price)}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <>
              <span className="price-old text-xs text-muted-foreground/60 line-through">
                {formatPrice(product.originalPrice)}
              </span>
              <span className="text-xs font-bold text-[#FF0000]">
                {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
              </span>
            </>
          )}
        </div>

        {/* Color swatches with variation images */}
        {product.colors && product.colors.length > 1 && (
          <div className="flex gap-1">
            {product.colors.slice(0, 4).map((color, index) => {
              const colorName = getColorName(color);
              const isSelected = selectedColor?.toLowerCase() === colorName.toLowerCase();

              // Get variation image for this color
              const variationForColor = product.variationImages?.find(
                (v) => v.color.toLowerCase() === colorName.toLowerCase()
              );
              const variationImage = variationForColor?.images?.[0];

              return (
                <button
                  key={index}
                  className={`w-8 h-8 rounded-md border overflow-hidden transition-all ${isSelected
                    ? "ring-2 ring-primary ring-offset-1 border-primary"
                    : "border-border hover:ring-2 hover:ring-primary hover:ring-offset-1"
                    }`}
                  title={colorName}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedColor(isSelected ? null : colorName);
                  }}
                >
                  {variationImage ? (
                    <img
                      src={variationImage}
                      alt={colorName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: getColorHex(color) }}
                    />
                  )}
                </button>
              );
            })}
            {product.colors.length > 4 && (
              <span className="text-xs text-muted-foreground self-center ml-1 font-bold">
                +{product.colors.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
