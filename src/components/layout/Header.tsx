import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useSearch } from "@/contexts/SearchContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWordPressPages } from "@/hooks/useWooCommerce";
import { useHomeConfig } from "@/hooks/useHomeConfig";
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
  const { isAuthenticated, user } = useAuth();
  const { data: pagesData, isLoading: pagesLoading } = useWordPressPages();

  // Matches the bottom nav: first name when logged in, otherwise "Login".
  const accountLabel = isAuthenticated
    ? (user?.name?.trim().split(" ")[0] || "My Account")
    : "Login";
  const { data: homeConfig } = useHomeConfig();

  const mobileMenu = homeConfig?.mobile_menu;

  // "wp_menu" mirrors the theme's Appearance → Menus menu; "manual" is the
  // plugin's own curated list. Either way the plugin sends resolved items.
  const curatedMenu =
    mobileMenu && mobileMenu.source !== "auto" && mobileMenu.items.length > 0
      ? mobileMenu.items
      : null;

  // Otherwise every published page, exactly as before the plugin existed.
  const menuItems = curatedMenu
    ? curatedMenu.map((item) => ({
        key: `m-${item.id}`,
        label: item.label,
        href: item.link,
        child: !!item.parent,
      }))
    : (pagesData || []).map((page) => ({
        key: `p-${page.id}`,
        label: page.title,
        href: `/page/${page.slug}`,
        child: false,
      }));

  const menuTitle = mobileMenu?.title || "Menu";
  const menuLoading = !curatedMenu && pagesLoading;
  const showMenuButton = !mobileMenu || mobileMenu.enabled;

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Shop All", href: "/collections/all" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <>
      <header className="relative lg:sticky lg:top-2 z-50 mx-2 lg:mx-4 bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] rounded-2xl">
        <div className="container mx-auto px-4">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between h-20">
            {/* Left - Burger */}
            <div className="flex items-center gap-1">
              {showMenuButton && (
                <Button
                  variant="ghost"
                  className="h-10 w-10 p-0 hover:bg-transparent hover:text-primary"
                  style={{ height: '40px', width: '40px' }}
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {isMenuOpen ? <AdornClose /> : <AdornMenu />}
                </Button>
              )}

                            <Link to="/wishlist" className="relative">
                <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-transparent hover:text-primary" style={{ height: '40px', width: '40px' }}>
                  <AdornHeart />
                </Button>
                {wishlistItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {wishlistItems}
                  </span>
                )}
              </Link>
            </div>

            {/* Center - Logo */}
            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              <img
                src="/logo.png"
                alt="Minikki"
                className="h-14 w-auto"
              />
            </Link>

            {/* Right - Account, Wishlist & Cart */}
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

          {/* Mobile Search */}
          <div className="lg:hidden pb-4">
            <div className="relative" onClick={openSearch}>
              <Input
                type="text"
                placeholder="Search products..."
                readOnly
                className="w-full h-11 pl-4 pr-12 rounded-full text-sm cursor-pointer"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Search"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 hover:bg-transparent hover:text-primary"
              >
                <AdornSearch />
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
              <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-sm bg-background text-black animate-slide-in flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-border shrink-0">
                  <span className="font-heading font-bold text-lg">{menuTitle}</span>
                  <Button variant="ghost" size="icon" className="hover:bg-transparent hover:text-primary" onClick={() => setIsMenuOpen(false)}>
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                {/* pb-28 keeps the last item clear of the fixed bottom nav bar */}
                <div className="p-4 pb-28 flex-1 overflow-y-auto">
                  <nav className="flex flex-col space-y-1">
                    {menuLoading && menuItems.length === 0 ? (
                      <p className="py-3 px-2 text-base text-muted-foreground">Loading menu…</p>
                    ) : menuItems.length === 0 ? (
                      <p className="py-3 px-2 text-base text-muted-foreground">No menu items</p>
                    ) : (
                      menuItems.map((item) => {
                        // Sub-menu items from a WordPress menu are indented and
                        // set slightly lighter than their parent.
                        const className = `py-3 text-base border-b border-border/50 hover:text-primary transition-colors ${
                          item.child ? "pl-6 pr-2 font-normal text-muted-foreground" : "px-2 font-medium"
                        }`;

                        return item.href.startsWith("http") ? (
                          <a
                            key={item.key}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={className}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link
                            key={item.key}
                            to={item.href}
                            className={className}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        );
                      })
                    )}
                  </nav>

                  {/* Account actions — flow directly after the last menu item */}
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <Link
                    to="/wishlist"
                    className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-base font-medium hover:border-primary hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Heart size={22} />
                    <span className="flex-1">Wishlist</span>
                    {wishlistItems > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                        {wishlistItems}
                      </span>
                    )}
                  </Link>

                  <Link
                    to="/account"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--surface-dark))] text-[hsl(var(--surface-dark-foreground))] px-4 py-3 text-base font-bold hover:opacity-90 transition-opacity"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <User size={20} />
                    {isAuthenticated ? accountLabel : "Login"}
                  </Link>
                  </div>
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
