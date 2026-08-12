import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, Truck, Package, ShieldCheck, ChevronDown, ChevronUp, Loader2, Heart, Ruler, X } from "@/lib/icons";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWooCommerceProductById, useWooCommerceProductGallery, useWooCommerceProducts } from "@/hooks/useWooCommerce";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { toast } from "sonner";
import type { Product } from "@/types/product";
import { getProductDetailImage, getGalleryThumbnail } from "@/lib/imageOptimizer";
import { getProductPriceDetails } from "@/lib/utils";

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

interface VariationImage {
  color: string;
  images: string[];
  attributes?: { name: string; option: string }[];
}

const ProductDetail = () => {
  const { id } = useParams();
  // Progressive loading: Fast initial load with basic variation images
  const { data: product, isLoading, error } = useWooCommerceProductById(id || "");
  // Background load: Full gallery images (only for variable products)
  const { data: productWithGallery } = useWooCommerceProductGallery(id || "", product?.type);

  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  // All state declarations at the top
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Reset quantity when stock changes or selection changes
  useEffect(() => {
    if (!product) return;
    const stock = getAvailableStock();
    if (stock !== null && quantity > stock) {
      setQuantity(Math.max(1, stock));
    } else if (stock === null || stock === 0) {
      // If out of stock, set quantity to 0 or keep at 1 if stock is null (unlimited)
      if (stock === 0) {
        setQuantity(0);
      }
    }
  }, [selectedSize, selectedColor, product?.id, product?.stockQuantity, product?.variationImages]);
  const [activeImage, setActiveImage] = useState(0);
  const [imageKey, setImageKey] = useState(0); // Key to force re-render for smooth transition
  const [expandedSection, setExpandedSection] = useState<string | null>("description");
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [enhancedVariationImages, setEnhancedVariationImages] = useState<VariationImage[] | null>(null);

  // Helper function to get available stock for current selection
  const getAvailableStock = (): number | null => {
    if (!product) return null;

    // For simple products, use product stock
    if (product.type === 'simple' || !product.type || product.type === 'external') {
      return product.stockQuantity ?? null;
    }

    // For variable products, find matching variation
    if (product.type === 'variable' && product.variationImages) {
      // Find variation by color (and ideally size, but we need full variation data for that)
      const matchingVariation = product.variationImages.find(
        (v) => v.color === selectedColor
      );

      if (matchingVariation && matchingVariation.stockQuantity !== null && matchingVariation.stockQuantity !== undefined) {
        return matchingVariation.stockQuantity;
      }

      // Fallback: if no stock data in variation, check if product has stock
      return product.stockQuantity ?? null;
    }

    return product.stockQuantity ?? null;
  };

  const isColorOutOfStock = (colorName: string): boolean => {
    if (!product || !product.variations || product.variations.length === 0) return false;
    const colorVariations = product.variations.filter(
      (v) => v.color.toLowerCase() === colorName.toLowerCase()
    );
    if (colorVariations.length === 0) return false;
    return colorVariations.every((v) => v.stockStatus === 'outofstock' || (v.manageStock && (v.stockQuantity === 0 || v.stockQuantity === null)));
  };

  const isSizeOutOfStock = (size: string): boolean => {
    if (!product || !product.variations || product.variations.length === 0) return false;

    if (selectedColor) {
      const variation = product.variations.find(
        (v) => v.color.toLowerCase() === selectedColor.toLowerCase() && v.size === size
      );
      if (!variation) return false;
      return variation.stockStatus === 'outofstock' || (variation.manageStock && (variation.stockQuantity === 0 || variation.stockQuantity === null));
    }

    const sizeVariations = product.variations.filter((v) => v.size === size);
    if (sizeVariations.length === 0) return false;
    return sizeVariations.every((v) => v.stockStatus === 'outofstock' || (v.manageStock && (v.stockQuantity === 0 || v.stockQuantity === null)));
  };

  const availableStock = getAvailableStock();
  const maxQuantity = availableStock !== null ? availableStock : Infinity;

  // Touch swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // Fetch recommended products from same category - skip variations for faster loading
  const { data: recommendedData } = useWooCommerceProducts({
    category: product?.categoryId,
    perPage: 5, // Fetch 5 to have enough after filtering out current product
    skipVariations: true,
    enabled: !!product?.categoryId, // Only fetch when we have the category
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

  // Progressive loading for variation images:
  // 1. First: Use basic variation images from fast load (1 image per color)
  // 2. Then: Upgrade to full gallery images when background load completes
  useEffect(() => {
    // If we have full gallery data, use that (has multiple images per color)
    if (productWithGallery?.variationImages && productWithGallery.variationImages.length > 0) {
      setEnhancedVariationImages(productWithGallery.variationImages);
    }
    // Otherwise use basic variation images from fast load
    else if (product?.variationImages && product.variationImages.length > 0) {
      setEnhancedVariationImages(product.variationImages);
    } else {
      setEnhancedVariationImages(null);
    }
  }, [product?.variationImages, productWithGallery?.variationImages]);

  // Touch swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleSwipe = (imagesLength: number) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left - go to next image
      const newIndex = (activeImage + 1) % imagesLength;
      setImageKey(prev => prev + 1);
      setActiveImage(newIndex);
    } else if (isRightSwipe) {
      // Swipe right - go to previous image
      const newIndex = (activeImage - 1 + imagesLength) % imagesLength;
      setImageKey(prev => prev + 1);
      setActiveImage(newIndex);
    }
  };

  const changeImage = (newIndex: number, imagesLength: number) => {
    setImageKey(prev => prev + 1);
    setActiveImage(newIndex);
  };

  // Get display images based on selected color
  const getDisplayImages = (): string[] => {
    if (!product) return ["/placeholder.svg"];

    // Use enhanced variation images if available and not empty, otherwise fallback to product variation images
    const sourceImages = (enhancedVariationImages && enhancedVariationImages.length > 0)
      ? enhancedVariationImages
      : (product.variationImages && product.variationImages.length > 0 ? product.variationImages : null);

    if (selectedColor && sourceImages && sourceImages.length > 0) {
      // Normalize color name for matching (trim and lowercase)
      const normalizedSelectedColor = selectedColor.trim().toLowerCase();

      // Try to find exact match with color AND size
      if (selectedSize) {
        const normalizedSelectedSize = selectedSize.trim().toLowerCase();
        const exactMatch = sourceImages.find((v: VariationImage) => {
          const normalizedColor = (v.color || '').trim().toLowerCase();
          const colorMatch = normalizedColor === normalizedSelectedColor;
          const sizeAttr = v.attributes?.find((a) => a.name?.toLowerCase() === "size");
          const sizeMatch = sizeAttr?.option?.trim().toLowerCase() === normalizedSelectedSize;
          return colorMatch && sizeMatch;
        });

        if (exactMatch && exactMatch.images && Array.isArray(exactMatch.images) && exactMatch.images.length > 0) {
          const filtered = exactMatch.images.filter((url: any) => url && typeof url === 'string' && url.trim());
          if (filtered.length > 0) {
            return filtered;
          }
        }
      }

      // Fallback to just color match (case-insensitive, trimmed)
      const variationMatch = sourceImages.find((v: VariationImage) => {
        const normalizedColor = (v.color || '').trim().toLowerCase();
        return normalizedColor === normalizedSelectedColor;
      });

      if (variationMatch && variationMatch.images && Array.isArray(variationMatch.images) && variationMatch.images.length > 0) {
        const filtered = variationMatch.images.filter((url: any) => url && typeof url === 'string' && url.trim());
        if (filtered.length > 0) {
          return filtered;
        }
      }
    }

    // Final fallback to product images
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const filtered = product.images.filter((url: any) => url && typeof url === 'string' && url.trim());
      if (filtered.length > 0) {
        return filtered;
      }
    }

    return ["/placeholder.svg"];
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="aspect-[3/4] bg-muted animate-pulse rounded-lg" />
              <div className="flex gap-2 justify-center">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-2 h-2 bg-muted rounded-full animate-pulse" />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="h-8 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-6 w-1/4 bg-muted animate-pulse rounded" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="h-12 bg-muted animate-pulse rounded" />
                <div className="h-12 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
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
  const priceDetails = getProductPriceDetails(product.price, product.originalPrice);
  const inWishlist = isInWishlist(product.id);

  const displayImages = getDisplayImages();

  // Optimize images for display (main image larger, thumbnails smaller)
  const optimizedDisplayImages = displayImages.map(img =>
    img.startsWith("/") || img.startsWith("data:")
      ? img
      : getProductDetailImage(img)
  );

  const optimizedThumbnails = displayImages.map(img =>
    img.startsWith("/") || img.startsWith("data:")
      ? img
      : getGalleryThumbnail(img)
  );

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

  const handleAddToCart = (buyNow = false) => {
    // Validation: Check if variation is selected if variations exist
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      setShowValidation(true);
      toast.error("Please select a color");
      return;
    }
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      setShowValidation(true);
      toast.error("Please select a size");
      return;
    }

    // Check if selected size/color combination is out of stock
    if (selectedSize && isSizeOutOfStock(selectedSize)) {
      toast.error(`Size ${selectedSize} is out of stock`);
      setSelectedSize(null);
      return;
    }
    if (selectedColor && isColorOutOfStock(selectedColor)) {
      toast.error(`Color ${selectedColor} is out of stock`);
      setSelectedColor(null);
      return;
    }

    // Check stock availability
    if (availableStock !== null && quantity > availableStock) {
      toast.error(`Only ${availableStock} items available in stock`);
      setQuantity(availableStock);
      return;
    }

    addToCart(product, quantity, selectedSize || undefined, selectedColor || undefined);

    if (buyNow) {
      navigate("/cart");
    } else {
      setShowValidation(false);
    }
  };

  const currentActiveImage = optimizedDisplayImages[activeImage] || "/placeholder.svg";

  return (
    <Layout>
      <div
        className="bg-white"
        style={{
          // Bright-white page: neutralize the warm theme tokens locally so
          // bg-background / bg-card / bg-muted inside this page render pure white/gray
          ["--background" as string]: "0 0% 100%",
          ["--card" as string]: "0 0% 100%",
          ["--muted" as string]: "0 0% 96%",
          ["--border" as string]: "0 0% 90%",
          ["--input" as string]: "0 0% 90%",
        } as React.CSSProperties}
      >
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

      <div className="container mx-auto px-4 py-2">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div
              className="aspect-[3/4] overflow-hidden bg-muted relative group touch-pan-y"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={() => handleSwipe(optimizedDisplayImages.length)}
            >
              <div className="relative w-full h-full overflow-hidden">
                <img
                  key={`img-${activeImage}-${imageKey}`}
                  src={currentActiveImage}
                  alt={product.name}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover pointer-events-none select-none animate-fade-in"
                  draggable={false}
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    if (target.src !== "/placeholder.svg") {
                      target.src = "/placeholder.svg";
                    }
                  }}
                />
              </div>

              {/* Wishlist Icon - Top Right */}
              <button
                onClick={() => toggleWishlist(product)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full hover:bg-white transition-colors shadow-sm"
              >
                <Heart className={`h-6 w-6 ${inWishlist ? "fill-primary text-primary" : "text-gray-600"}`} />
              </button>

              {selectedColor && (
                <span className="absolute top-4 left-4 bg-[#8B4B6B] text-white text-xs px-2 py-1 font-medium capitalize">
                  {selectedColor} Color
                </span>
              )}
              {!selectedColor && product.discount && (
                <span className="absolute top-4 left-4 bg-primary text-primary-foreground text-sm px-4 py-2 font-medium">
                  -{product.discount}%
                </span>
              )}

              {/* Navigation Arrows - Desktop */}
              {optimizedDisplayImages.length > 1 && (
                <>
                  <button
                    onClick={() => changeImage((activeImage - 1 + optimizedDisplayImages.length) % optimizedDisplayImages.length, optimizedDisplayImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() => changeImage((activeImage + 1) % optimizedDisplayImages.length, optimizedDisplayImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            {/* Navigation Dots */}
            {optimizedDisplayImages.length > 1 && (
              <div className="flex gap-2 justify-center mt-4">
                {optimizedThumbnails.map((thumb, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      changeImage(index, optimizedDisplayImages.length);
                      setTouchStart(null); // Reset touch state on click
                    }}
                    className={`rounded-full transition-all duration-300 ${activeImage === index
                      ? "w-2.5 h-2.5 bg-black ring-1 ring-offset-2 ring-black scale-110"
                      : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                      }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-2">
            {/* Title & Price */}
            <div>
              <h1 className="font-heading text-xl lg:text-2xl font-extrabold text-black tracking-tight">
                {product.name}
              </h1>
              <div className="flex items-center flex-wrap gap-3 mt-3">
                <span className="text-xl lg:text-2xl font-extrabold text-[#B91C1C]">{formatPrice(priceDetails.offerPrice)}</span>
                <span className="text-base lg:text-lg font-medium text-gray-400 line-through">
                  {formatPrice(priceDetails.actualPrice)}
                </span>
                <span className="text-xs lg:text-sm font-bold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-2.5 py-1 rounded-md">
                  {priceDetails.discountPercentage}% OFF
                </span>
              </div>

            </div>

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className={`text-sm font-medium ${showValidation && !selectedColor ? "text-red-600" : ""}`}>
                    Color{selectedColor && <span className="capitalize font-bold text-primary">: {selectedColor}</span>}
                    {showValidation && !selectedColor && <span className="ml-2 text-red-600 animate-pulse">(Required)</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color, index) => {
                    const colorName = typeof color === "string" ? color : color.name;
                    const colorHex = typeof color === "string" ? getColorHex(color) : color.hex;
                    const isSelected = selectedColor?.toLowerCase() === colorName.toLowerCase();

                    // Get variation image for this color (check enhanced first, then fallback)
                    const sourceVariations = (enhancedVariationImages && enhancedVariationImages.length > 0)
                      ? enhancedVariationImages
                      : product.variationImages;
                    const variationForColor = sourceVariations?.find(
                      (v) => (v.color || '').trim().toLowerCase() === colorName.trim().toLowerCase()
                    );
                    const variationImage = variationForColor?.images?.[0];
                    const outOfStock = isColorOutOfStock(colorName);

                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (outOfStock) return;
                          const newColor = isSelected ? null : colorName;
                          setSelectedColor(newColor);
                          // Deselect size if it's out of stock for this color
                          if (newColor && selectedSize && product.variations) {
                            const variation = product.variations.find(
                              (v) => v.color.toLowerCase() === newColor.toLowerCase() && v.size === selectedSize
                            );
                            if (variation && (variation.stockStatus === 'outofstock' || (variation.manageStock && (variation.stockQuantity === 0 || variation.stockQuantity === null)))) {
                              setSelectedSize(null);
                            }
                          }
                          setActiveImage(0);
                          if (showValidation) setShowValidation(false);
                        }}
                        className={`w-14 h-20 sm:w-20 sm:h-28 rounded-md border-2 transition-all relative overflow-hidden ${isSelected
                          ? "border-[3px] border-black ring-0" // Bolder black active border
                          : "border-border hover:border-foreground"
                          } ${outOfStock ? "opacity-60" : ""}`}
                        title={colorName + (outOfStock ? " (Out of Stock)" : "")}
                      >
                        {variationImage ? (
                          <img
                            src={variationImage}
                            alt={colorName}
                            className="w-full h-full object-cover object-top border-2 border-white"
                          />
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: colorHex }}
                          />
                        )}
                        {outOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <X className="w-12 h-12 text-black/40 stroke-[1px]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {product.sizes.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className={`text-sm font-medium ${showValidation && !selectedSize ? "text-red-600" : ""}`}>
                    Size
                    {showValidation && !selectedSize && <span className="ml-2 text-red-600 animate-pulse">(Required)</span>}
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="text-xs font-medium flex items-center gap-1 hover:text-primary border border-foreground px-2 py-1 rounded">
                        <Ruler className="w-3 h-3" /> Size Chart
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4">
                      <DialogHeader>
                        <DialogTitle>Size Chart</DialogTitle>
                      </DialogHeader>
                      <img
                        src="/size-chart.jpg"
                        alt="Minikki Size Chart"
                        className="w-full h-auto rounded-lg"
                      />
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => {
                    const outOfStock = isSizeOutOfStock(size);
                    return (
                      <button
                        key={size}
                        onClick={() => {
                          if (outOfStock) return;
                          setSelectedSize(size);
                          setActiveImage(0);
                          if (showValidation) setShowValidation(false);
                        }}
                        disabled={outOfStock}
                        className={`min-w-[40px] h-10 px-2.5 text-sm sm:min-w-[48px] sm:h-12 sm:px-3 sm:text-base border font-bold transition-all relative ${selectedSize === size
                          ? "border-foreground bg-foreground text-background"
                          : "border-black hover:bg-muted bg-background"
                          } ${outOfStock ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                        title={outOfStock ? "Out of Stock" : ""}
                      >
                        {size}
                        {outOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <X className="w-8 h-8 text-black/40 stroke-[1px]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="flex items-center gap-4 pt-1 sm:pt-2.5">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-border bg-background">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="px-3 py-2 hover:bg-muted transition-colors"
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-medium">{quantity}</span>
                  <button
                    onClick={() => {
                      if (availableStock !== null && quantity >= availableStock) {
                        toast.error(`Only ${availableStock} items available in stock`);
                        return;
                      }
                      setQuantity(q => q + 1);
                    }}
                    className="px-3 py-2 hover:bg-muted transition-colors"
                    disabled={availableStock !== null && quantity >= availableStock}
                  >
                    +
                  </button>
                </div>
                {availableStock !== null && (
                  <span className="text-sm text-muted-foreground">
                    ({availableStock} available)
                  </span>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-4">
              <div className="flex flex-row gap-2 sm:gap-3">
                <Button
                  className="flex-1 h-11 sm:h-12 bg-black text-white hover:bg-black/90 rounded-none text-sm sm:text-base font-bold"
                  disabled={product.isSoldOut}
                  onClick={() => handleAddToCart(false)}
                >
                  {product.isSoldOut ? "SOLD OUT" : "ADD TO CART"}
                </Button>
                <Button
                  className="flex-1 h-11 sm:h-12 bg-[#800000] text-white hover:bg-[#800000]/90 rounded-none text-sm sm:text-base font-bold"
                  disabled={product.isSoldOut}
                  onClick={() => handleAddToCart(true)}
                >
                  BUY NOW
                </Button>
                <a
                  href={`https://wa.me/917338733187?text=${encodeURIComponent(`Hi, I'm interested in "${product.name}" - ${typeof window !== "undefined" ? window.location.href : ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white transition-colors"
                  aria-label="Ask about this product on WhatsApp"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Mobile: single "Description" button opening a right-side drawer */}
            <div className="lg:hidden border-t border-border mt-6">
              <Sheet>
                <SheetTrigger asChild>
                  <button className="w-full flex items-center justify-between py-4 text-left">
                    <span className="font-medium">Description</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[88%] sm:max-w-md overflow-y-auto p-0">
                  <SheetHeader className="sticky top-0 bg-background border-b border-border px-5 py-4 text-left">
                    <SheetTitle className="text-xl font-heading">Description</SheetTitle>
                  </SheetHeader>
                  <div className="prose prose-sm max-w-none px-5 py-4 text-foreground leading-relaxed">
                    {product.shortDescription && (
                      <p className="mb-2">{stripHtml(product.shortDescription)}</p>
                    )}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: product.description || "No description available.",
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Accordion Sections (desktop) */}
            <div className="hidden lg:block border-t border-border mt-6">
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
              {(product.shippingPolicy || product.returnPolicy || !product.shippingPolicy) && (
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
                      {product.shippingPolicy ? (
                        <div dangerouslySetInnerHTML={{ __html: product.shippingPolicy }} />
                      ) : (
                        <>
                          <p>Free shipping on all orders across India.</p>
                          <p>Delivery time: 15-20 working days</p>
                        </>
                      )}
                      {product.returnPolicy && (
                        <div dangerouslySetInnerHTML={{ __html: product.returnPolicy }} className="mt-2" />
                      )}
                    </div>
                  )}
                </div>
              )}

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
                    <p>Available sizes: XS, S, M, L, XL, XXL, 3XL, 4XL</p>
                    <p>For size guidance, please refer to our size chart below.</p>
                    <img src="/size-chart.jpg" alt="Size Chart" className="w-full h-auto rounded-lg my-3" />
                    <p>Full lining available (inside)</p>
                    <p>Best quality and best stitching</p>
                  </div>
                )}
              </div>

              {/* Wash Care */}
              {(product.washCare || !product.washCare) && (
                <div className="border-b border-border">
                  <button
                    onClick={() => toggleSection("washcare")}
                    className="w-full flex items-center justify-between py-4 text-left"
                  >
                    <span className="font-medium">Wash Care</span>
                    {expandedSection === "washcare" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {expandedSection === "washcare" && (
                    <div className="pb-4 text-sm text-muted-foreground leading-relaxed space-y-2">
                      {product.washCare ? (
                        <div dangerouslySetInnerHTML={{ __html: product.washCare }} />
                      ) : (
                        <>
                          <p>Machine wash cold with like colors.</p>
                          <p>Do not bleach.</p>
                          <p>Tumble dry low.</p>
                          <p>Warm iron if needed.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

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
              <p className="font-medium text-sm">Free Shipping</p>
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
      </div>
    </Layout >
  );
};

export default ProductDetail;
