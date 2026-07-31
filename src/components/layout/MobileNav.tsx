import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { Home, User, Heart, ShoppingBag, Package } from "@/lib/icons";

// Bottom-nav icons (Phosphor)
const AdornHome = () => <Home size={24} />;
const AdornUser = () => <User size={24} />;
const AdornHeart = () => <Heart size={24} />;
const AdornCart = () => <ShoppingBag size={24} />;
const AdornOrders = () => <Package size={24} />;

const MobileNav = () => {
  const location = useLocation();
  const { totalItems: cartItems } = useCart();
  const { totalItems: wishlistItems } = useWishlist();
  const { isAuthenticated, user } = useAuth();

  // Show login state on the account tab: first name when logged in, otherwise "Login"
  const accountLabel = isAuthenticated
    ? (user?.name?.trim().split(" ")[0] || "Account")
    : "Login";

  const navItems = [
    { icon: AdornHome, label: "Home", href: "/" },
    { icon: AdornOrders, label: "Orders", href: "/orders" }, 
    { icon: AdornCart, label: "Cart", href: "/cart", count: cartItems },
    { icon: AdornUser, label: accountLabel, href: "/account" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-4 left-3 right-3 bg-background border border-border z-50 shadow-[0_0_10px_rgba(0,0,0,0.1)] rounded-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? location.pathname === item.href : false;

          return (
            <Link
              key={item.label}
              to={item.href!}
              className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors relative ${isActive ? "text-secondary font-bold" : "text-black"
                }`}
            >
              <div className="relative -mt-0.5">
                <Icon />
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {item.count}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide max-w-[56px] truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
