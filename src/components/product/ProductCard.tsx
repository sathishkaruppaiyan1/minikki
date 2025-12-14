import { Link } from "react-router-dom";
import { Heart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const formatPrice = (price: number) => {
    return `Rs. ${price.toLocaleString("en-IN")}`;
  };

  return (
    <div className="group animate-fade-in">
      <div className="relative overflow-hidden bg-muted aspect-[3/4]">
        <Link to={`/product/${product.id}`}>
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.discount && (
            <span className="badge-sale text-xs px-2 py-1 font-medium">
              -{product.discount}%
            </span>
          )}
          {product.isNew && (
            <span className="badge-new text-xs px-2 py-1 font-medium">
              New
            </span>
          )}
          {product.isSoldOut && (
            <span className="badge-soldout text-xs px-2 py-1 font-medium">
              Sold out
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="icon"
            size="iconSm"
            className="bg-background/90 hover:bg-background shadow-sm"
          >
            <Heart className="h-4 w-4" />
          </Button>
          <Button
            variant="icon"
            size="iconSm"
            className="bg-background/90 hover:bg-background shadow-sm"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Product info */}
      <div className="mt-3 space-y-2">
        <Link to={`/product/${product.id}`}>
          <h3 className="text-sm font-medium hover:text-primary transition-colors line-clamp-1">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2">
          {product.originalPrice && (
            <span className="price-old text-sm">{formatPrice(product.originalPrice)}</span>
          )}
          <span className="price text-sm">{formatPrice(product.price)}</span>
        </div>

        {/* Color swatches */}
        {product.colors.length > 1 && (
          <div className="flex gap-1">
            {product.colors.slice(0, 4).map((color, index) => (
              <button
                key={index}
                className="w-5 h-5 rounded-full border border-border hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all"
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
            {product.colors.length > 4 && (
              <span className="text-xs text-muted-foreground self-center ml-1">
                +{product.colors.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
