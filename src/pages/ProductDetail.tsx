import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronLeft, Truck, Package, ShieldCheck, ChevronDown, ChevronUp, Loader2, Heart, Ruler, Upload, Star } from "lucide-react";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { useWooCommerceProductById, useWooCommerceProducts, useWooCommerceReviews, useSubmitWooCommerceReview, type CreateReviewData } from "@/hooks/useWooCommerce";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { toast } from "sonner";
import type { Product } from "@/types/product";
import { supabase } from "@/integrations/supabase/client";

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
  const { data: product, isLoading, error } = useWooCommerceProductById(id || "");
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  // All state declarations at the top
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>("description");
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [enhancedVariationImages, setEnhancedVariationImages] = useState<VariationImage[] | null>(null);

  // Review State
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewForm, setReviewForm] = useState({
    name: "",
    email: "",
    title: "",
    review: ""
  });
  const [reviewFiles, setReviewFiles] = useState<string[]>([]); // Base64 strings
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const { data: reviews, isLoading: isLoadingReviews, refetch: refetchReviews } = useWooCommerceReviews(product?.id || "");
  const submitReview = useSubmitWooCommerceReview();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const base64Promises = filesArray.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      try {
        const base64Files = await Promise.all(base64Promises);
        setReviewFiles(prev => [...prev, ...base64Files].slice(0, 5)); // Limit to 5
      } catch (error) {
        console.error("Error converting files:", error);
        toast.error("Error uploading images");
      }
    }
  };

  const handleReviewSubmit = async () => {
    if (!rating) {
      toast.error("Please select a rating");
      return;
    }
    if (!reviewForm.name || !reviewForm.email || !reviewForm.review) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const reviewData: CreateReviewData = {
        product_id: typeof product?.id === 'string' ? parseInt(product.id) : product?.id || 0,
        review: `<p>${reviewForm.review}</p>`, // WooCommerce expects HTML usually, or plain text
        reviewer: reviewForm.name,
        reviewer_email: reviewForm.email,
        rating: rating,
        images: reviewFiles
      };

      await submitReview(reviewData);
      toast.success("Review submitted successfully!");
      setReviewForm({ name: "", email: "", title: "", review: "" });
      setRating(0);
      setReviewFiles([]);
      refetchReviews();
    } catch (error) {
      console.error("Review submission failed:", error);
      toast.error("Failed to submit review. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Touch swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

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

  // Fetch variation gallery images from backend function
  useEffect(() => {
    if (!product?.id || product.type !== "variable") return;

    const fetchVariationGalleryImages = async () => {
      try {
        console.log("Fetching variation gallery for product:", product.id);

        const { data, error } = await supabase.functions.invoke("woocommerce-variation-gallery", {
          body: { product_id: product.id },
        });

        if (error) {
          console.error("Variation gallery invoke error:", error);
          return;
        }

        console.log("Variation gallery response:", data);

        if (data?.variationGallery && Array.isArray(data.variationGallery) && data.variationGallery.length > 0) {
          const variationImagesResult: VariationImage[] = data.variationGallery.map((item: any) => ({
            color: item.color,
            images: Array.isArray(item.images) ? item.images : [],
          }));

          setEnhancedVariationImages(variationImagesResult);
        }
      } catch (e) {
        console.error("Failed to fetch variation gallery images:", e);
      }
    };

    fetchVariationGalleryImages();
  }, [product?.id, product?.type]);

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
      setActiveImage((prev) => (prev + 1) % imagesLength);
    } else if (isRightSwipe) {
      // Swipe right - go to previous image
      setActiveImage((prev) => (prev - 1 + imagesLength) % imagesLength);
    }
  };

  // Get display images based on selected color
  const getDisplayImages = (): string[] => {
    if (!product) return ["/placeholder.svg"];

    const sourceImages = enhancedVariationImages || product.variationImages;

    if (selectedColor && sourceImages) {
      // Try to find exact match with color AND size
      if (selectedSize) {
        const exactMatch = sourceImages.find((v: VariationImage) => {
          const colorMatch = v.color.toLowerCase() === selectedColor.toLowerCase();
          const sizeAttr = v.attributes?.find((a) => a.name.toLowerCase() === "size");
          const sizeMatch = sizeAttr?.option.toLowerCase() === selectedSize.toLowerCase();
          return colorMatch && sizeMatch;
        });

        if (exactMatch && exactMatch.images.length > 0) {
          return exactMatch.images.filter(Boolean);
        }
      }

      // Fallback to just color match
      const variationMatch = sourceImages.find(
        (v: VariationImage) => v.color.toLowerCase() === selectedColor.toLowerCase()
      );
      if (variationMatch && variationMatch.images.length > 0) {
        return variationMatch.images.filter(Boolean);
      }
    }
    return product.images?.length > 0 ? product.images.filter(Boolean) : ["/placeholder.svg"];
  };

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
  const inWishlist = isInWishlist(product.id);

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

    addToCart(product, quantity, selectedSize || undefined, selectedColor || undefined);

    if (buyNow) {
      navigate("/cart");
    } else {
      setShowValidation(false);
    }
  };

  const currentActiveImage = displayImages[activeImage] || "/placeholder.svg";

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

      <div className="container mx-auto px-4 py-2">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div
              className="aspect-[3/4] overflow-hidden bg-muted relative group touch-pan-y"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={() => handleSwipe(displayImages.length)}
            >
              <img
                src={currentActiveImage}
                alt={product.name}
                className="w-full h-full object-cover pointer-events-none select-none"
                draggable={false}
              />

              {/* Wishlist Icon - Top Right */}
              <button
                onClick={() => toggleWishlist(product)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full hover:bg-white transition-colors shadow-sm"
              >
                <Heart className={`h-6 w-6 ${inWishlist ? "fill-[#800000] text-[#800000]" : "text-gray-600"}`} />
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
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage((prev) => (prev - 1 + displayImages.length) % displayImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() => setActiveImage((prev) => (prev + 1) % displayImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            {/* Navigation Dots */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 justify-center mt-4">
                {displayImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveImage(index);
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
              <h1 className="font-heading text-xl lg:text-2xl font-semibold text-foreground">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xl font-bold text-[#800000]">{formatPrice(product.price)}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <>
                    <span className="text-muted-foreground/60 line-through text-lg">
                      {formatPrice(product.originalPrice)}
                    </span>
                    <span className="text-sm font-bold text-[#FF0000] border border-[#FF0000] px-2 py-0.5 rounded-sm">
                      {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                    </span>
                  </>
                )}
              </div>

            </div>

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className={`text-sm font-medium ${showValidation && !selectedColor ? "text-red-600" : ""}`}>
                    Color{selectedColor && <span className="capitalize font-bold text-[#800000]">: {selectedColor}</span>}
                    {showValidation && !selectedColor && <span className="ml-2 text-red-600 animate-pulse">(Required)</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color, index) => {
                    const colorName = typeof color === "string" ? color : color.name;
                    const colorHex = typeof color === "string" ? getColorHex(color) : color.hex;
                    const isSelected = selectedColor?.toLowerCase() === colorName.toLowerCase();

                    // Get variation image for this color
                    const variationForColor = product.variationImages?.find(
                      (v) => v.color.toLowerCase() === colorName.toLowerCase()
                    );
                    const variationImage = variationForColor?.images?.[0];

                    return (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedColor(isSelected ? null : colorName);
                          setActiveImage(0);
                          if (showValidation) setShowValidation(false);
                        }}
                        className={`w-20 h-28 rounded-md border-2 transition-all overflow-hidden ${isSelected
                          ? "border-[3px] border-black ring-0" // Bolder black active border
                          : "border-border hover:border-foreground"
                          }`}
                        title={colorName}
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
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {product.sizes.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className={`text-sm font-medium ${showValidation && !selectedSize ? "text-red-600" : ""}`}>
                    Size
                    {showValidation && !selectedSize && <span className="ml-2 text-red-600 animate-pulse">(Required)</span>}
                  </p>
                  <button className="text-xs font-medium flex items-center gap-1 hover:text-primary border border-foreground px-2 py-1 rounded">
                    <Ruler className="w-3 h-3" /> Size Chart
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setSelectedSize(size);
                        setActiveImage(0);
                        if (showValidation) setShowValidation(false);
                      }}
                      className={`min-w-[48px] h-12 px-3 border text-base font-bold transition-all ${selectedSize === size
                        ? "border-foreground bg-foreground text-background"
                        : "border-black hover:bg-muted bg-background"
                        }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="flex items-center gap-4" style={{ paddingTop: '10px' }}>
              <span className="text-sm font-medium">Quantity</span>
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
                  onClick={() => setQuantity(q => q + 1)}
                  className="px-3 py-2 hover:bg-muted transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Dispatch Time & Buttons */}
            <div className="space-y-4">
              <div className="text-sm font-bold text-green-700">
                Dispatch time : 5 days
              </div>

              <div className="flex flex-row gap-3">
                <Button
                  className="flex-1 h-12 bg-foreground text-background hover:bg-foreground/90 rounded-none text-base font-bold"
                  disabled={product.isSoldOut}
                  onClick={() => handleAddToCart(false)}
                >
                  {product.isSoldOut ? "SOLD OUT" : "ADD TO CART"}
                </Button>
                <Button
                  className="flex-1 h-12 bg-[#8B0000] text-white hover:bg-[#6B0000] rounded-none text-base font-bold"
                  disabled={product.isSoldOut}
                  onClick={() => handleAddToCart(true)}
                >
                  BUY NOW
                </Button>
              </div>
            </div>

            {/* Accordion Sections */}
            <div className="border-t border-border mt-6">
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

              {/* Wash Care */}
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
                    <p>Machine wash cold with like colors.</p>
                    <p>Do not bleach.</p>
                    <p>Tumble dry low.</p>
                    <p>Warm iron if needed.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <section className="border-t border-border pt-10">
          <h2 className="font-heading text-2xl font-semibold text-center mb-8">Customer Reviews</h2>

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Rating Summary */}
            <div className="flex flex-col md:flex-row gap-8 p-6 bg-muted/30 rounded-xl">
              {/* Overall Rating */}
              <div className="text-center md:border-r md:border-border md:pr-8 md:min-w-[180px]">
                <div className="text-5xl font-bold">{product.averageRating || "0.0"}</div>
                <div className="flex justify-center gap-1 my-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${star <= Math.round(parseFloat(product.averageRating + "") || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{product.ratingCount || 0} reviews</p>
              </div>

              {/* Rating Breakdown - Placeholder Logic (WC API doesn't always return breakdown) */}
              <div className="flex-1 space-y-3">
                {/*  If we had breakdown data, we'd map it here. For now static or hidden if no data */}
                <div className="text-sm text-muted-foreground text-center italic">
                  Rating breakdown available for verified purchases.
                </div>
              </div>
            </div>

            {/* Write a Review Section */}
            <div className="border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-5">Write a Review</h3>

              {/* Star Rating Input */}
              <div className="mb-5">
                <p className="text-sm font-medium mb-2">Your Rating *</p>
                <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className="p-1 transition-transform hover:scale-110"
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => setRating(star)}
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${star <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                          }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Title */}
              <div className="mb-5">
                <p className="text-sm font-medium mb-2">Review Title</p>
                <input
                  type="text"
                  placeholder="Give your review a title"
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                  className="w-full p-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              {/* Review Text */}
              <div className="mb-5">
                <p className="text-sm font-medium mb-2">Your Review *</p>
                <textarea
                  placeholder="Share your experience with this product..."
                  value={reviewForm.review}
                  onChange={(e) => setReviewForm({ ...reviewForm, review: e.target.value })}
                  className="w-full p-3 border border-border rounded-lg text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              {/* Image/Video Upload */}
              <div className="mb-5">
                <p className="text-sm font-medium mb-2">Add Photos/Videos</p>
                <div className="flex gap-3 flex-wrap">
                  {reviewFiles.map((file, idx) => (
                    <div key={idx} className="relative w-24 h-24 border border-border rounded-xl overflow-hidden">
                      <img src={file} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setReviewFiles(files => files.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"
                      >
                        <ChevronDown className="w-4 h-4 rotate-45" /> {/* Close icon substitute */}
                      </button>
                    </div>
                  ))}
                  {reviewFiles.length < 5 && (
                    <label className="w-24 h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-foreground hover:bg-muted/50 transition-all">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Upload up to 5 images (max 10MB each)</p>
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <p className="text-sm font-medium mb-2">Your Name *</p>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={reviewForm.name}
                    onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                    className="w-full p-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Your Email *</p>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={reviewForm.email}
                    onChange={(e) => setReviewForm({ ...reviewForm, email: e.target.value })}
                    className="w-full p-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>

              <Button
                onClick={handleReviewSubmit}
                disabled={isSubmittingReview}
                className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-base font-semibold"
              >
                {isSubmittingReview ? <Loader2 className="animate-spin mr-2" /> : null}
                Submit Review
              </Button>
            </div>

            {/* Customer Reviews List */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">All Reviews ({reviews?.length || 0})</h3>
              </div>

              {isLoadingReviews ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : reviews && reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="border-b border-border pb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} className={`w-4 h-4 ${star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                          ))}
                        </div>
                        <span className="font-semibold">{review.reviewer}</span>
                        <span className="text-xs text-muted-foreground">{new Date(review.date_created).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: review.review }} />
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="text-center py-12 border border-border rounded-xl bg-muted/20">
                  <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="font-medium text-lg mb-2">No Reviews Yet</h4>
                  <p className="text-sm text-muted-foreground mb-4">Be the first to review this product!</p>
                </div>
              )}
            </div>
          </div>
        </section>

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
    </Layout >
  );
};

export default ProductDetail;
