import { Link, useLocation } from "react-router-dom";
import { useSearch } from "@/contexts/SearchContext";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";

// Adorn Icons - Thin line style SVGs
const AdornHome = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5">
    <path d="M3 10.5L12 3L21 10.5V21H15V15C15 14.4477 14.5523 14 14 14H10C9.44772 14 9 14.4477 9 15V21H3V10.5Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornUser = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5">
    <circle cx="12" cy="8" r="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 21C20 16.5817 16.4183 13 12 13C7.58172 13 4 16.5817 4 21" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornSearch = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5">
    <circle cx="10" cy="10" r="7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 15L21 21" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornHeart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5">
    <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AdornCart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5">
    <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 6H21" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MobileNav = () => {
  const location = useLocation();
  const { openSearch } = useSearch();
  const { totalItems: cartItems } = useCart();
  const { totalItems: wishlistItems } = useWishlist();

  const navItems = [
    { icon: AdornHome, label: "Home", href: "/" },
    { icon: AdornUser, label: "Account", href: "/account" },
    { icon: AdornSearch, label: "Search", action: openSearch },
    { icon: AdornHeart, label: "Wishlist", href: "/wishlist", count: wishlistItems },
    { icon: AdornCart, label: "Cart", href: "/cart", count: cartItems },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 shadow-[0_0_10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href ? location.pathname === item.href : false;

          if (item.action) {
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="flex flex-col items-center gap-1 px-3 py-1 transition-colors text-muted-foreground hover:text-foreground"
              >
                <div className="relative -mt-0.5">
                  <Icon />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wide">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.href!}
              className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors relative ${isActive ? "text-[#800000]" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <div className="relative -mt-0.5">
                <Icon />
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#800000] text-white text-[10px] flex items-center justify-center font-bold">
                    {item.count}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
