import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useRecentOrdersSocialProof } from "@/hooks/useWooCommerce";
import { X, CheckCircle } from "@/lib/icons";

// Timing (ms)
const INITIAL_DELAY = 5000; // wait before the first popup
const VISIBLE_MS = 6000;    // how long each popup stays
const GAP_MS = 9000;        // pause between popups

const relativeTime = (iso: string | null): string => {
  if (!iso) return "recently";
  // WooCommerce GMT timestamps often lack a timezone suffix — treat as UTC.
  const hasTz = /Z|[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(hasTz ? iso : `${iso}Z`);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return "recently";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const SocialProofPopup = () => {
  const { data: items = [] } = useRecentOrdersSocialProof();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hoverRef = useRef(false);

  useEffect(() => {
    if (dismissed || items.length === 0) return;
    let timer: number;
    let cancelled = false;

    const showNext = () => {
      if (cancelled) return;
      setShown(true);
      timer = window.setTimeout(hideCurrent, VISIBLE_MS);
    };

    const hideCurrent = () => {
      if (cancelled) return;
      // Don't dismiss while the user is hovering — retry shortly.
      if (hoverRef.current) {
        timer = window.setTimeout(hideCurrent, 1500);
        return;
      }
      setShown(false);
      timer = window.setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        showNext();
      }, GAP_MS);
    };

    timer = window.setTimeout(showNext, INITIAL_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [items, dismissed]);

  if (dismissed || items.length === 0) return null;

  const item = items[index % items.length];
  if (!item) return null;

  return (
    <div
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      className={`fixed left-3 bottom-24 lg:bottom-5 z-40 w-[300px] max-w-[calc(100vw-1.5rem)] transition-all duration-500 ease-out motion-reduce:transition-none ${
        shown
          ? "opacity-100 translate-x-0 translate-y-0"
          : "opacity-0 -translate-x-5 translate-y-2 pointer-events-none"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center gap-3 rounded-2xl border border-border bg-background p-3 pr-8 shadow-xl">
        <Link
          to={item.productId ? `/product/${item.productId}` : "#"}
          className="flex items-center gap-3 min-w-0"
        >
          <img
            src={item.productImage || "/placeholder.svg"}
            alt={item.productName}
            loading="lazy"
            className="h-14 w-14 flex-shrink-0 rounded-xl object-cover bg-muted"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              if (t.src !== "/placeholder.svg") t.src = "/placeholder.svg";
            }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {item.firstName} from {item.city}
            </p>
            <p className="text-xs text-muted-foreground leading-tight truncate">
              bought {item.productName}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>{relativeTime(item.dateCreated)}</span>
              <span aria-hidden>·</span>
              <CheckCircle size={12} weight="fill" className="text-green-600" />
              <span>Verified</span>
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default SocialProofPopup;
