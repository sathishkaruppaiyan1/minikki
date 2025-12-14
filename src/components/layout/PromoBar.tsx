import { X } from "lucide-react";
import { useState } from "react";

const PromoBar = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="promo-bar py-2 px-4 text-center text-sm relative">
      <span>Free shipping for all the products</span>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
        aria-label="Close promo bar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default PromoBar;
