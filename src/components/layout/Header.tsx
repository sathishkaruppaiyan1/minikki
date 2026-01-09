import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useSearch } from "@/contexts/SearchContext";
import { useWooCommerceCategories } from "@/hooks/useWooCommerce";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from "lucide-react";

// Adorn Icons - Light line style SVGs
// Adorn Icons - Bolder style SVGs
const AdornMenu = () => (
  <svg width="26px" height="26px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '26px', height: '26px' }}>
    <path d="M3 6H21M3 12H21M3 18H21" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornClose = () => (
  <svg width="26px" height="26px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '26px', height: '26px' }}>
    <path d="M6 6L18 18M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornHeart = () => (
  <svg width="26px" height="26px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '26px', height: '26px' }}>
    <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornCart = () => (
  <svg width="26px" height="26px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '26px', height: '26px' }}>
    <path d="M6 6H21L19 16H8L6 6Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="17" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornUser = () => (
  <svg width="26px" height="26px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '26px', height: '26px' }}>
    <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 21C5.5 17.134 8.41015 14 12 14C15.5899 14 18.5 17.134 18.5 21" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornSearch = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="10" cy="10" r="7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 15L21 21" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { totalItems: cartItems, setIsOpen: setCartOpen } = useCart();
  const { totalItems: wishlistItems } = useWishlist();
  const { openSearch } = useSearch();
  const { data: categoriesData } = useWooCommerceCategories();
  const categories = categoriesData?.categories || [];

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Shop All", href: "/collections/all" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <>
      <header className="bg-background z-50">
        <div className="container mx-auto px-4">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between h-20">
            {/* Left - Burger & Wishlist */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="h-10 w-10 p-0"
                style={{ height: '40px', width: '40px' }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <AdornClose /> : <AdornMenu />}
              </Button>
              <Link to="/wishlist">
                <Button variant="ghost" className="h-10 w-10 p-0" style={{ height: '40px', width: '40px' }}>
                  <AdornHeart />
                </Button>
              </Link>
            </div>

            {/* Center - Logo */}
            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              <img
                src="/logo_new.png"
                alt="Blacklovers"
                className="h-24 w-auto"
              />
            </Link>

            {/* Right - Cart & Account */}
            {/* Right - Account & Cart */}
            <div className="flex items-center gap-1">
              <Link to="/account">
                <Button variant="ghost" className="h-10 w-10 p-0" style={{ height: '40px', width: '40px' }}>
                  <AdornUser />
                </Button>
              </Link>
              <Button variant="ghost" className="h-10 w-10 relative p-0" style={{ height: '40px', width: '40px' }} onClick={() => setCartOpen(true)}>
                <AdornCart />
                {cartItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#800000] text-white text-[10px] flex items-center justify-center font-bold">
                    {cartItems}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between h-24">
            {/* Logo - Left aligned */}
            <Link to="/" className="flex-shrink-0">
              <img
                src="/logo_new.png"
                alt="Blacklovers"
                className="h-18 w-auto"
              />
            </Link>

            {/* Desktop Search - Center */}
            <div className="flex flex-1 max-w-xl mx-8">
              <div className="relative w-full" onClick={openSearch}>
                <Input
                  type="text"
                  placeholder="Search here for all products"
                  className="w-full pl-4 pr-12 py-3 h-12 border-border rounded-full text-base cursor-pointer"
                  readOnly
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                >
                  <AdornSearch />
                </Button>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="flex items-center gap-8 mr-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-sm font-medium uppercase tracking-wider hover:text-primary transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            {/* Right icons */}
            <div className="flex items-center gap-2">
              <Link to="/account">
                <Button variant="ghost" size="icon">
                  <AdornUser />
                </Button>
              </Link>
              <Link to="/wishlist" className="relative">
                <Button variant="ghost" size="icon">
                  <AdornHeart />
                </Button>
                {wishlistItems > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#800000] text-white text-xs flex items-center justify-center font-bold">
                    {wishlistItems}
                  </span>
                )}
              </Link>
              <Button variant="ghost" size="icon" className="relative" onClick={() => setCartOpen(true)}>
                <AdornCart />
                {cartItems > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#800000] text-white text-xs flex items-center justify-center font-bold">
                    {cartItems}
                  </span>
                )}
              </Button>
            </div>
          </div>



          {/* Mobile Sidebar (Menu & Categories) */}
          {isMenuOpen && (
            <div className="fixed inset-0 z-[60] lg:hidden">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setIsMenuOpen(false)}
              />
              {/* Sidebar Content */}
              <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-sm bg-background animate-slide-in">
                <div className="flex justify-between items-center p-4 border-b border-border">
                  <span className="font-heading font-bold text-lg">Menu</span>
                  <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(false)}>
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                <div className="p-4">
                  <Tabs defaultValue="menu" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="menu">Menu</TabsTrigger>
                      <TabsTrigger value="categories">Categories</TabsTrigger>
                    </TabsList>

                    <TabsContent value="menu" className="space-y-4">
                      <nav className="flex flex-col space-y-2">
                        {navLinks.map((link) => (
                          <Link
                            key={link.name}
                            to={link.href}
                            className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {link.name}
                          </Link>
                        ))}
                        <Link
                          to="/account"
                          className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          My Account
                        </Link>
                        <Link
                          to="/wishlist"
                          className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors flex items-center gap-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Wishlist
                        </Link>
                        <Link
                          to="/orders"
                          className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors flex items-center gap-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M16 4H18C18.5304 4 19.0391 4.21071 19.4142 4.58579C19.7893 4.96086 20 5.46957 20 6V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H6C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 2H9C8.44772 2 8 2.44772 8 3V5C8 5.55228 8.44772 6 9 6H15C15.5523 6 16 5.55228 16 5V3C16 2.44772 15.5523 2 15 2Z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Order Details
                        </Link>
                        <Link
                          to="/size-chart"
                          className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors flex items-center gap-2"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21.3 8.7L8.7 21.3C8.3 21.7 7.7 21.7 7.3 21.3L2.7 16.7C2.3 16.3 2.3 15.7 2.7 15.3L15.3 2.7C15.7 2.3 16.3 2.3 16.7 2.7L21.3 7.3C21.7 7.7 21.7 8.3 21.3 8.7Z" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6 18L12 12" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 14L14 10" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Size Chart
                        </Link>
                      </nav>
                    </TabsContent>

                    <TabsContent value="categories" className="space-y-4">
                      <div className="flex flex-col space-y-2 max-h-[70vh] overflow-y-auto">
                        <Link
                          to="/collections/all"
                          className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          All Products
                        </Link>
                        {categories.map((cat) => (
                          <Link
                            key={cat.id}
                            to={`/collections/${cat.slug}`}
                            className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors flex items-center justify-between"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <span>{cat.name}</span>
                            {cat.image && (
                              <img src={cat.image} alt={cat.name} className="w-8 h-8 rounded-full object-cover" />
                            )}
                          </Link>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Search - Full Width below header (Not Sticky) */}
      <div className="container mx-auto px-4 lg:hidden pb-3 pt-4">
        <div className="relative" onClick={openSearch}>
          <Input
            type="text"
            placeholder="Search here for all products"
            className="w-full pl-4 pr-12 py-2 border-2 border-foreground rounded-xl cursor-pointer placeholder:font-medium h-10"
            readOnly
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9"
          >
            <AdornSearch />
          </Button>
        </div>
      </div>
    </>
  );
};

export default Header;
