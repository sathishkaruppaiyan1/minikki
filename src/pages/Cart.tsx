import { Link } from "react-router-dom";
import { Minus, Plus, X, ShoppingBag, ArrowLeft } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

const Cart = () => {
  const { items, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();

  const formatPrice = (price: number) => `Rs. ${price.toLocaleString("en-IN")}.00`;

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <ShoppingBag className="h-24 w-24 mx-auto text-muted-foreground mb-6" />
            <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-muted-foreground mb-8">
              Looks like you haven't added anything to your cart yet.
            </p>
            <Link to="/collections/all">
              <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-none font-bold px-8 py-6">
                CONTINUE SHOPPING
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="bg-muted py-8 text-center">
        <h1 className="font-heading text-3xl lg:text-4xl">Shopping Cart</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Home &gt; Cart
        </p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-border font-bold text-sm">
              <div className="col-span-6">Product</div>
              <div className="col-span-2 text-center">Price</div>
              <div className="col-span-2 text-center">Quantity</div>
              <div className="col-span-2 text-right">Total</div>
            </div>

            {/* Items */}
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={`${item.product.id}-${item.size}`} className="py-6">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Product */}
                    <div className="col-span-12 md:col-span-6">
                      <div className="flex gap-4">
                        <div className="w-24 h-32 bg-muted flex-shrink-0 overflow-hidden">
                          <img
                            src={item.product.images[0] || "/placeholder.svg"}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/product/${item.product.id}`}
                            className="font-bold hover:text-primary transition-colors line-clamp-2"
                          >
                            {item.product.name}
                          </Link>
                          {(item.size || item.color) && (
                            <p className="text-sm text-muted-foreground mt-1 uppercase">
                              {[item.size, item.color].filter(Boolean).join(", ")}
                            </p>
                          )}
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-sm text-muted-foreground hover:text-destructive transition-colors mt-2 flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="col-span-4 md:col-span-2 text-center">
                      <span className="md:hidden text-sm text-muted-foreground">Price: </span>
                      <span className="font-bold">{formatPrice(item.product.price)}</span>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 md:col-span-2 flex justify-center">
                      <div className="flex items-center border border-border">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="col-span-4 md:col-span-2 text-right">
                      <span className="md:hidden text-sm text-muted-foreground">Total: </span>
                      <span className="font-bold">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4 pt-6 border-t border-border">
              <Link to="/collections/all">
                <Button variant="outline" className="rounded-none font-bold">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Continue Shopping
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={clearCart}
                className="rounded-none font-bold text-destructive hover:text-destructive"
              >
                Clear Cart
              </Button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-muted p-6 sticky top-28">
              <h2 className="text-xl font-bold mb-6">Order Summary</h2>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
                  <span className="font-bold">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-bold text-green-600">FREE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-bold">Calculated at checkout</span>
                </div>
              </div>

              <div className="border-t border-border mt-6 pt-6">
                <div className="flex justify-between text-lg">
                  <span className="font-bold">Total</span>
                  <span className="font-bold">{formatPrice(totalPrice)}</span>
                </div>
              </div>

              <Link to="/checkout" className="block mt-6">
                <Button className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 rounded-none font-bold">
                  PROCEED TO CHECKOUT
                </Button>
              </Link>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Shipping & taxes calculated at checkout
              </p>

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-border space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Secure Checkout</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 6H21L19 16H8L6 6Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="10" cy="20" r="1.5" />
                    <circle cx="17" cy="20" r="1.5" />
                  </svg>
                  <span>Free Shipping All Over India</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>15-20 Days Delivery</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Cart;
