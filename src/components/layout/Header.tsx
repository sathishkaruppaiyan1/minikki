import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, User, Heart, ShoppingCart, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/collections/all" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Mobile menu button */}
          <Button
            variant="icon"
            size="iconSm"
            className="lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Wishlist for mobile */}
          <Button variant="icon" size="iconSm" className="lg:hidden">
            <Heart className="h-5 w-5" />
          </Button>

          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-wide">
              BLACKLOVERS
            </h1>
          </Link>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Input
                type="text"
                placeholder="Search here for all products"
                className="w-full pl-4 pr-10 py-2 border-border rounded-sm"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8 mr-8">
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
          <div className="flex items-center gap-1 lg:gap-2">
            <Button
              variant="icon"
              size="iconSm"
              className="lg:hidden"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              <Search className="h-5 w-5" />
            </Button>
            
            <Button variant="icon" size="iconSm" className="hidden lg:flex">
              <User className="h-5 w-5" />
            </Button>
            <span className="hidden lg:inline text-sm">Account</span>
            
            <Button variant="icon" size="iconSm" className="hidden lg:flex ml-4">
              <Heart className="h-5 w-5" />
            </Button>
            
            <Button variant="icon" size="iconSm" className="relative ml-2">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                0
              </span>
            </Button>
            <span className="hidden lg:inline text-sm">Cart</span>
          </div>
        </div>

        {/* Mobile Search */}
        {isSearchOpen && (
          <div className="lg:hidden pb-4 animate-fade-in">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search here for all products"
                className="w-full pl-4 pr-10 py-2 border-border"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}

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
