import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { Product } from "@/types/product";

interface CartItem {
  product: Product;
  quantity: number;
  size?: string;
  color?: string;
  image?: string;
  variationId?: number;
}

export interface StockIssue {
  productId: string;
  productName: string;
  size?: string;
  color?: string;
  issue: 'out_of_stock' | 'quantity_exceeded' | 'product_removed';
  availableStock?: number;
  requestedQuantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, size?: string, color?: string) => void;
  removeFromCart: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  clearCart: () => void;
  validateCartStock: () => Promise<StockIssue[]>;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Fetch fresh product data from API
async function fetchFreshProduct(productId: string): Promise<Product | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/woocommerce-products?id=${productId}&skip_variations=true&status=publish`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return data.products?.[0] || null;
  } catch {
    return null;
  }
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("cart");
      const parsed = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) return [];
      // Drop malformed entries (e.g., saved by an older app version)
      return parsed.filter(
        (item): item is CartItem =>
          item &&
          typeof item === "object" &&
          item.product &&
          typeof item.product === "object" &&
          item.product.id != null &&
          typeof item.quantity === "number" &&
          item.quantity > 0
      );
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  // Validate all cart items against live stock from WooCommerce
  const validateCartStock = useCallback(async (): Promise<StockIssue[]> => {
    if (items.length === 0) return [];

    const issues: StockIssue[] = [];

    // Get unique product IDs to avoid duplicate fetches
    const uniqueProductIds = [...new Set(items.map(item => item.product.id))];

    // Fetch fresh data for all products in parallel
    const freshProducts = await Promise.all(
      uniqueProductIds.map(async (id) => ({
        id,
        product: await fetchFreshProduct(id),
      }))
    );

    const freshProductMap = new Map<string, Product | null>();
    freshProducts.forEach(({ id, product }) => freshProductMap.set(id, product));

    const updatedItems: CartItem[] = [];

    for (const item of items) {
      const freshProduct = freshProductMap.get(item.product.id);

      // Product no longer exists or not published
      if (!freshProduct) {
        issues.push({
          productId: item.product.id,
          productName: item.product.name,
          size: item.size,
          color: item.color,
          issue: 'product_removed',
          requestedQuantity: item.quantity,
        });
        continue; // Don't keep this item
      }

      // Product-level sold out
      if (freshProduct.isSoldOut) {
        issues.push({
          productId: item.product.id,
          productName: freshProduct.name,
          size: item.size,
          color: item.color,
          issue: 'out_of_stock',
          availableStock: 0,
          requestedQuantity: item.quantity,
        });
        continue; // Don't keep this item
      }

      // Check variation-level stock for variable products
      if (freshProduct.type === 'variable' && freshProduct.variations && item.size) {
        const matchingVariation = freshProduct.variations.find(
          (v) => v.size === item.size && (!item.color || v.color.toLowerCase() === (item.color || '').toLowerCase())
        );

        if (matchingVariation?.stockStatus === 'outofstock') {
          issues.push({
            productId: item.product.id,
            productName: freshProduct.name,
            size: item.size,
            color: item.color,
            issue: 'out_of_stock',
            availableStock: 0,
            requestedQuantity: item.quantity,
          });
          continue; // Don't keep this item
        }

        // Check if quantity exceeds variation stock
        if (matchingVariation?.manageStock && matchingVariation.stockQuantity !== null) {
          if (item.quantity > matchingVariation.stockQuantity) {
            if (matchingVariation.stockQuantity <= 0) {
              issues.push({
                productId: item.product.id,
                productName: freshProduct.name,
                size: item.size,
                color: item.color,
                issue: 'out_of_stock',
                availableStock: 0,
                requestedQuantity: item.quantity,
              });
              continue;
            }
            issues.push({
              productId: item.product.id,
              productName: freshProduct.name,
              size: item.size,
              color: item.color,
              issue: 'quantity_exceeded',
              availableStock: matchingVariation.stockQuantity,
              requestedQuantity: item.quantity,
            });
            // Keep item but adjust quantity
            updatedItems.push({
              ...item,
              product: freshProduct,
              quantity: matchingVariation.stockQuantity,
            });
            continue;
          }
        }
      }

      // Check product-level stock for simple products
      if (freshProduct.stockQuantity !== null && freshProduct.stockQuantity !== undefined) {
        if (item.quantity > freshProduct.stockQuantity) {
          if (freshProduct.stockQuantity <= 0) {
            issues.push({
              productId: item.product.id,
              productName: freshProduct.name,
              size: item.size,
              color: item.color,
              issue: 'out_of_stock',
              availableStock: 0,
              requestedQuantity: item.quantity,
            });
            continue;
          }
          issues.push({
            productId: item.product.id,
            productName: freshProduct.name,
            size: item.size,
            color: item.color,
            issue: 'quantity_exceeded',
            availableStock: freshProduct.stockQuantity,
            requestedQuantity: item.quantity,
          });
          updatedItems.push({
            ...item,
            product: freshProduct,
            quantity: freshProduct.stockQuantity,
          });
          continue;
        }
      }

      // Item is valid — update with fresh product data
      updatedItems.push({ ...item, product: freshProduct });
    }

    // Update cart with validated items (removes out-of-stock, adjusts quantities)
    if (issues.length > 0) {
      setItems(updatedItems);
    } else {
      // Even if no issues, refresh product snapshots with latest data
      setItems(updatedItems);
    }

    return issues;
  }, [items]);

  const addToCart = (product: Product, quantity = 1, size?: string, color?: string) => {
    // Block adding out-of-stock variations (stockStatus check, independent of stockQuantity)
    if (product.type === 'variable' && product.variations && size) {
      const matchingVariation = product.variations.find(
        (v) => v.size === size && (!color || v.color.toLowerCase() === (color || '').toLowerCase())
      );
      if (matchingVariation?.stockStatus === 'outofstock') {
        import('sonner').then(({ toast }) => {
          toast.error(`Size ${size} is out of stock`);
        });
        return;
      }
    }

    // Block adding product-level out-of-stock
    if (product.isSoldOut) {
      import('sonner').then(({ toast }) => {
        toast.error('This product is sold out');
      });
      return;
    }

    // Helper to get available stock for this product/variation
    const getAvailableStock = (): number | null => {
      if (product.type === 'simple' || !product.type || product.type === 'external') {
        return product.stockQuantity ?? null;
      }
      if (product.type === 'variable' && product.variationImages && color) {
        const variation = product.variationImages.find(v => v.color === color);
        if (variation?.stockQuantity !== null && variation?.stockQuantity !== undefined) {
          return variation.stockQuantity;
        }
      }
      return product.stockQuantity ?? null;
    };

    const availableStock = getAvailableStock();

    // Check stock before adding
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.size === size && item.color === color
      );

      const currentQuantity = existingIndex > -1 ? prev[existingIndex].quantity : 0;
      const newTotalQuantity = currentQuantity + quantity;

      // Validate stock
      if (availableStock !== null && newTotalQuantity > availableStock) {
        // Import toast dynamically to avoid circular dependency
        import('sonner').then(({ toast }) => {
          toast.error(`Only ${availableStock} items available in stock`);
        });
        // Cap at available stock
        quantity = Math.max(0, availableStock - currentQuantity);
        if (quantity <= 0) {
          return prev; // Don't add if no stock available
        }
      }
      
      // Get variation ID
      let variationId: number | undefined;
      if (product.type === 'variable' && (size || color)) {
        const matchingVariation = product.variations?.find(
          (v) => 
            (!size || v.size === size) && 
            (!color || v.color.toLowerCase() === color.toLowerCase())
        );
        variationId = matchingVariation?.id;
      }

      let image = product.images[0];

      // Try to resolve variation image
      if (color) {
        // Check variationImages first as it's more specific usually
        if (product.variationImages) {
          const variation = product.variationImages.find(v => v.color === color);
          if (variation?.images?.[0]) {
            image = variation.images[0];
          }
        }
        // Fallback to colors array if it has image info
        else if (Array.isArray(product.colors) && typeof product.colors[0] === 'object') {
          const colorObj = (product.colors as any[]).find(c => c.name === color);
          if (colorObj?.image) {
            image = colorObj.image;
          }
        }
      }

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        // Update image just in case it changed (though unlikely for same variation)
        if (image) updated[existingIndex].image = image;
        return updated;
      }

      return [...prev, { product, quantity, size, color, image, variationId }];
    });
    setIsOpen(true);
  };

  const removeFromCart = (productId: string, size?: string, color?: string) => {
    setItems((prev) =>
      prev.filter(
        (item) =>
          !(item.product.id === productId && item.size === size && item.color === color)
      )
    );
  };

  const updateQuantity = (productId: string, quantity: number, size?: string, color?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }

    setItems((prev) => {
      const item = prev.find(
        (item) => item.product.id === productId && item.size === size && item.color === color
      );

      if (!item) return prev;

      // Get available stock for this product/variation
      const getAvailableStock = (): number | null => {
        const product = item.product;
        if (product.type === 'simple' || !product.type || product.type === 'external') {
          return product.stockQuantity ?? null;
        }
        if (product.type === 'variable' && product.variationImages && color) {
          const variation = product.variationImages.find(v => v.color === color);
          if (variation?.stockQuantity !== null && variation?.stockQuantity !== undefined) {
            return variation.stockQuantity;
          }
        }
        return product.stockQuantity ?? null;
      };

      const availableStock = getAvailableStock();

      // Validate stock
      if (availableStock !== null && quantity > availableStock) {
        // Import toast dynamically to avoid circular dependency
        import('sonner').then(({ toast }) => {
          toast.error(`Only ${availableStock} items available in stock`);
        });
        quantity = availableStock; // Cap at available stock
      }

      return prev.map((item) =>
        item.product.id === productId && item.size === size && item.color === color
          ? { ...item, quantity }
          : item
      );
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + (item.product?.price ?? 0) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        validateCartStock,
        totalItems,
        totalPrice,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
