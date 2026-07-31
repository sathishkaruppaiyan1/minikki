import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getProductPriceDetails(price: number, originalPrice?: number) {
  const offerPrice = price;
  const actualPrice = offerPrice * 3;
  const discountPercentage = actualPrice > offerPrice
    ? Math.round(((actualPrice - offerPrice) / actualPrice) * 100)
    : 0;

  return {
    actualPrice,
    offerPrice,
    discountPercentage,
  };
}
