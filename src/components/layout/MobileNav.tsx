import { Link, useLocation } from "react-router-dom";

// Adorn Icons - Light line style SVGs
const AdornHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M3 10.5L12 3L21 10.5V21H15V15C15 14.4477 14.5523 14 14 14H10C9.44772 14 9 14.4477 9 15V21H3V10.5Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdornUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
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

const AdornHeart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AdornCart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M6 6H21L19 16H8L6 6Z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6L5 3H2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="20" r="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    { icon: AdornHome, label: "Home", href: "/" },
    { icon: AdornUser, label: "Account", href: "/account" },
    { icon: AdornSearch, label: "Search", href: "/search" },
    { icon: AdornHeart, label: "Wishlist", href: "/wishlist" },
    { icon: AdornCart, label: "Cart", href: "/cart" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 shadow-[0_0_10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.label}
              to={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
