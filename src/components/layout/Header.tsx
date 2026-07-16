import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useSearch } from "@/contexts/SearchContext";
import { useWordPressPages } from "@/hooks/useWooCommerce";
import {
  X,
  Menu,
  Heart,
  ShoppingBag,
  User,
  Search,
} from "@/lib/icons";

// Header icons (Phosphor)
const AdornMenu = () => <Menu size={26} />;
const AdornClose = () => <X size={26} />;
const AdornHeart = () => <Heart size={26} />;
const AdornCart = () => <ShoppingBag size={26} />;
const AdornUser = () => <User size={26} />;
const AdornSearch = () => <Search size={24} />;

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { totalItems: cartItems, setIsOpen: setCartOpen } = useCart();
  const { totalItems: wishlistItems } = useWishlist();
  const { openSearch } = useSearch();
  const { data: pagesData, isLoading: pagesLoading } = useWordPressPages();
  const menuPages = pagesData || [];

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Shop All", href: "/collections/all" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <>
      <header className="sticky top-2 z-50 mx-2 lg:mx-4 bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] rounded-2xl">
        <div className="container mx-auto px-4">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between h-20">
            {/* Left - Burger & Search */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="h-10 w-10 p-0 hover:bg-transparent hover:text-primary"
                style={{ height: '40px', width: '40px' }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <AdornClose /> : <AdornMenu />}
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-10 p-0 hover:bg-transparent hover:text-primary"
                style={{ height: '40px', width: '40px' }}
                onClick={openSearch}
                aria-label="Search"
              >
                <AdornSearch />
              </Button>
            </div>

            {/* Center - Logo */}
            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              <img
                src="/logo.png"
                alt="Minikki"
                className="h-14 w-auto"
              />
            </Link>

            {/* Right - Cart & Account */}
            {/* Right - Account & Cart */}
            <div className="flex items-center gap-1">
              <Link to="/account">
                <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-transparent hover:text-primary" style={{ height: '40px', width: '40px' }}>
                  <AdornUser />
                </Button>
              </Link>
              <Button variant="ghost" className="h-10 w-10 relative p-0 hover:bg-transparent hover:text-primary" style={{ height: '40px', width: '40px' }} onClick={() => setCartOpen(true)}>
                <AdornCart />
                {cartItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
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
                src="/logo.png"
                alt="Minikki"
                className="h-14 w-auto"
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-transparent hover:text-primary"
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
                <Button variant="ghost" size="icon" className="hover:bg-transparent hover:text-primary">
                  <AdornUser />
                </Button>
              </Link>
              <Link to="/wishlist" className="relative">
                <Button variant="ghost" size="icon" className="hover:bg-transparent hover:text-primary">
                  <AdornHeart />
                </Button>
                {wishlistItems > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    {wishlistItems}
                  </span>
                )}
              </Link>
              <Button variant="ghost" size="icon" className="relative hover:bg-transparent hover:text-primary" onClick={() => setCartOpen(true)}>
                <AdornCart />
                {cartItems > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
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
              <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-sm bg-background text-black animate-slide-in">
                <div className="flex justify-between items-center p-4 border-b border-border">
                  <span className="font-heading font-bold text-lg">Menu</span>
                  <Button variant="ghost" size="icon" className="hover:bg-transparent hover:text-primary" onClick={() => setIsMenuOpen(false)}>
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                <div className="p-4">
                  <nav className="flex flex-col space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto">
                    {pagesLoading && menuPages.length === 0 ? (
                      <p className="py-3 px-2 text-base text-muted-foreground">Loading menu…</p>
                    ) : menuPages.length === 0 ? (
                      <p className="py-3 px-2 text-base text-muted-foreground">No menu items</p>
                    ) : (
                      menuPages.map((page) => (
                        <Link
                          key={page.id}
                          to={`/page/${page.slug}`}
                          className="py-3 px-2 text-base font-medium border-b border-border/50 hover:text-primary transition-colors"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {page.title}
                        </Link>
                      ))
                    )}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
