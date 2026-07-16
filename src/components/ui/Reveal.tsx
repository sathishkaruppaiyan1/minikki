import { ReactNode } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

/**
 * Wraps content in a zoom-out reveal that triggers when it scrolls into view.
 * Use for images rendered inside a map (where a hook can't be called per item).
 */
export const Reveal = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal-zoom ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
};

export default Reveal;
