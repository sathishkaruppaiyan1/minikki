import { Link, useLocation } from "react-router-dom";
import { Home, User, Search, Heart, ShoppingCart } from "lucide-react";

const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: User, label: "Account", href: "/account" },
    { icon: Search, label: "Search", href: "/search" },
    { icon: Heart, label: "Wishlist", href: "/wishlist" },
    { icon: ShoppingCart, label: "Cart", href: "/cart" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.label}
              to={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
