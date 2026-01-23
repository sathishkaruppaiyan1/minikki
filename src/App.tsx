import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider } from "./contexts/CartContext";
import { WishlistProvider } from "./contexts/WishlistContext";
import { QuickViewProvider } from "./contexts/QuickViewContext";
import { SearchProvider } from "./contexts/SearchContext";
import CartDrawer from "./components/cart/CartDrawer";
import QuickViewModal from "./components/product/QuickViewModal";
import SearchModal from "./components/search/SearchModal";
import RouteLoading from "./components/ui/RouteLoading";

// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const Collection = lazy(() => import("./pages/Collection"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Checkout = lazy(() => import("./pages/Checkout"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const Account = lazy(() => import("./pages/Account"));
const WordPressPage = lazy(() => import("./pages/WordPressPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <WishlistProvider>
          <QuickViewProvider>
            <SearchProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/collections/:slug" element={<Collection />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/thank-you" element={<ThankYou />} />
                    <Route path="/account" element={<Account />} />
                    {/* WordPress Pages - uses :slug param */}
                    <Route path="/page/:slug" element={<WordPressPage />} />
                    {/* Shortcut routes for common pages */}
                    <Route path="/about" element={<WordPressPage />} />
                    <Route path="/terms" element={<WordPressPage />} />
                    <Route path="/shipping" element={<WordPressPage />} />
                    <Route path="/privacy" element={<WordPressPage />} />
                    <Route path="/refund" element={<WordPressPage />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <CartDrawer />
                <QuickViewModal />
                <SearchModal />
              </BrowserRouter>
            </SearchProvider>
          </QuickViewProvider>
        </WishlistProvider>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
