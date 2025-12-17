import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useSearch } from "@/contexts/SearchContext";

// Adorn Icons - Light line style SVGs
const AdornMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M3 6H21M3 12H21M3 18H21" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdornClose = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M6 6L18 18M6 18L18 6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdornHeart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdornCart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M6 6H21L19 16H8L6 6Z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdornUser = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.5 21C5.5 17.134 8.41015 14 12 14C15.5899 14 18.5 17.134 18.5 21" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdornSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <circle cx="10" cy="10" r="7" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 15L21 21" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { totalItems: cartItems, setIsOpen: setCartOpen } = useCart();
  const { totalItems: wishlistItems } = useWishlist();
  const { openSearch } = useSearch();

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/collections/all" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        {/* Mobile Header */}
        <div className="flex lg:hidden items-center justify-between h-14">
          {/* Left - Burger & Wishlist */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <AdornClose /> : <AdornMenu />}
            </Button>
            <Link to="/wishlist">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <AdornHeart />
              </Button>
            </Link>
          </div>

          {/* Center - Logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <img
              src="/logo.webp"
              alt="Blacklovers"
              className="h-14 w-auto"
            />
          </Link>

          {/* Right - Cart & Account */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10 relative" onClick={() => setCartOpen(true)}>
              <AdornCart />
              {cartItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {cartItems}
                </span>
              )}
            </Button>
            <Link to="/account">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <AdornUser />
              </Button>
            </Link>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between h-24">
          {/* Logo - Left aligned */}
          <Link to="/" className="flex-shrink-0">
            <img
              src="/logo.webp"
              alt="Blacklovers"
              className="h-20 w-auto"
            />
          </Link>

          {/* Desktop Search - Center */}
          <div className="flex flex-1 max-w-xl mx-8">
            <div className="relative w-full" onClick={openSearch}>
              <Input
                type="text"
                placeholder="Search here for all products"
                className="w-full pl-4 pr-12 py-3 h-12 border-border rounded-md text-base cursor-pointer"
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
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {wishlistItems}
                </span>
              )}
            </Link>
            <Button variant="ghost" size="icon" className="relative" onClick={() => setCartOpen(true)}>
              <AdornCart />
              {cartItems > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {cartItems}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Search - Full Width below header */}
        <div className="lg:hidden pb-3">
          <div className="relative" onClick={openSearch}>
            <Input
              type="text"
              placeholder="Search here for all products"
              className="w-full pl-4 pr-12 py-2.5 border-border rounded-md cursor-pointer"
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

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-border animate-fade-in">
            <nav className="py-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="block text-sm font-medium uppercase tracking-wider hover:text-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
