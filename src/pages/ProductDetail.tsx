import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Heart, Truck, Package, ShieldCheck, Minus, Plus } from "lucide-react";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { products } from "@/data/products";
import type { ProductColor } from "@/types/product";

// Helper to check if color is ProductColor object or string
const isProductColor = (color: ProductColor | string): color is ProductColor => {
  return typeof color === 'object' && 'hex' in color;
};

const ProductDetail = () => {
  const { id } = useParams();
  const product = products.find((p) => p.id === id);
  
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  if (!product) {
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

  const formatPrice = (price: number) => `Rs. ${price.toLocaleString("en-IN")}`;

  const recommendedProducts = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <p className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          {" > "}
          <Link to={`/collections/${product.category}`} className="hover:text-foreground capitalize">
            {product.category}
          </Link>
          {" > "}
          <span className="text-foreground">{product.name}</span>
        </p>
      </div>

      <div className="container mx-auto px-4 pb-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-[3/4] overflow-hidden bg-muted relative">
              <img
                src={(() => {
                  const color = product.colors[selectedColor];
                  if (color && isProductColor(color)) return color.image;
                  return product.images[activeImage];
                })()}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.discount && (
                <span className="absolute top-4 left-4 badge-sale text-sm px-3 py-1 font-medium">
                  Grape Color
                </span>
              )}
            </div>
            
            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(index)}
                  className={`flex-shrink-0 w-16 h-20 border-2 transition-colors ${
                    activeImage === index ? "border-foreground" : "border-transparent"
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
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-heading text-2xl lg:text-3xl font-semibold">
                  {product.name}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  {product.originalPrice && (
                    <span className="price-old text-lg">{formatPrice(product.originalPrice)}</span>
                  )}
                  <span className="price text-xl">{formatPrice(product.price)}</span>
                </div>
              </div>
              <Button variant="icon" size="icon">
                <Heart className="h-5 w-5" />
              </Button>
            </div>

            {/* Color Selection */}
            <div>
              <p className="text-sm font-medium mb-2">
                COLOR: <span className="font-normal">
                  {(() => {
                    const color = product.colors[selectedColor];
                    if (color && isProductColor(color)) return color.name;
                    return typeof color === 'string' ? color : '';
                  })()}
                </span>
              </p>
              <div className="flex gap-2">
                {product.colors.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedColor(index)}
                    className={`w-10 h-10 rounded border-2 transition-all ${
                      selectedColor === index
                        ? "border-foreground ring-2 ring-offset-2 ring-foreground"
                        : "border-border hover:border-foreground"
                    }`}
                    style={{ backgroundColor: isProductColor(color) ? color.hex : color }}
                    title={isProductColor(color) ? color.name : color}
                  />
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  SIZE: <span className="font-normal">{selectedSize || "Select size"}</span>
                </p>
                <button className="text-sm underline text-muted-foreground hover:text-foreground">
                  Size Chart
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[40px] h-10 px-3 border text-sm transition-colors ${
                      selectedSize === size
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Wishlist & Delivery */}
            <div className="flex items-center gap-6 text-sm">
              <button className="flex items-center gap-2 hover:text-primary transition-colors">
                <Heart className="h-4 w-4" />
                Add to Wishlist
              </button>
              <button className="flex items-center gap-2 hover:text-primary transition-colors">
                <Truck className="h-4 w-4" />
                Delivery & Returns
              </button>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="flex gap-4">
              <div className="flex items-center border border-border">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button variant="addToCart" className="flex-1" disabled={product.isSoldOut}>
                {product.isSoldOut ? "Sold Out" : "Add to Cart"}
              </Button>
            </div>

            <Button variant="buyNow" className="w-full" disabled={product.isSoldOut}>
              Buy Now
            </Button>

            {/* Shipping Info */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Get Free shipping for All Products
              </p>
              <p className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Delivery: 15 to 20 working days
              </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="description" className="mt-8">
              <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
                <TabsTrigger
                  value="description"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 pb-3"
                >
                  Description
                </TabsTrigger>
                <TabsTrigger
                  value="shipping"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 pb-3"
                >
                  Shipping & Returns
                </TabsTrigger>
                <TabsTrigger
                  value="size"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 pb-3"
                >
                  Size & Fit
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 pb-3"
                >
                  Reviews
                </TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-4 text-sm leading-relaxed">
                <p>{product.description}</p>
                {product.fabric && <p className="mt-2">Fabric: {product.fabric}</p>}
                {product.length && <p>Gown length: {product.length}</p>}
                <p className="mt-2">Size: S to 3XL</p>
                <p>Full lining available (inside)</p>
                <p>Best quality and best stitching</p>
                <p>Sleeve: 3/4 roll full</p>
              </TabsContent>
              <TabsContent value="shipping" className="mt-4 text-sm leading-relaxed">
                <p>Free shipping on all orders across India.</p>
                <p className="mt-2">Delivery time: 15-20 working days</p>
                <p className="mt-2">Easy returns within 7 days of delivery.</p>
              </TabsContent>
              <TabsContent value="size" className="mt-4 text-sm leading-relaxed">
                <p>Available sizes: S, M, L, XL, 2XL, 3XL, 4XL, 5XL</p>
                <p className="mt-2">For size guidance, please refer to our size chart.</p>
              </TabsContent>
              <TabsContent value="reviews" className="mt-4 text-sm leading-relaxed">
                <p className="text-muted-foreground">No reviews yet. Be the first to review this product!</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-4 mt-12 py-8 border-t border-b border-border text-center">
          <div className="flex flex-col items-center gap-2">
            <Package className="h-6 w-6" />
            <div>
              <p className="font-medium text-sm">Safe Payment</p>
              <p className="text-xs text-muted-foreground">Pay with the world's most payment methods</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            <div>
              <p className="font-medium text-sm">Buy With Confidence</p>
              <p className="text-xs text-muted-foreground">GST & MSME Registered brand</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Truck className="h-6 w-6" />
            <div>
              <p className="font-medium text-sm">Free Delivery</p>
              <p className="text-xs text-muted-foreground">FREE SHIPPING to All Over India</p>
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
      </div>
    </Layout>
  );
};

export default ProductDetail;
