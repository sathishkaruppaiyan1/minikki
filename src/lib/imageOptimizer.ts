/**
 * Image optimization utility
 * Optimizes image URLs for faster loading with responsive sizes and compression
 */

export interface ImageOptimizeOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'webp' | 'jpg' | 'png' | 'auto';
}

/**
 * Optimize image URL with size and quality parameters
 * Supports WordPress image resizing via query params or CDN
 */
export const optimizeImage = (
  src: string,
  options: ImageOptimizeOptions = {}
): string => {
  if (!src || src.startsWith('/') || src.startsWith('data:')) {
    return src; // Local or data URLs - return as-is
  }

  const { width, height, quality = 85, format } = options;

  try {
    const url = new URL(src);

    // WordPress image optimization via query params
    // Many WordPress sites support ?w=, ?h=, ?q=, ?format=webp
    if (width) url.searchParams.set('w', width.toString());
    if (height) url.searchParams.set('h', height.toString());
    if (quality !== 85) url.searchParams.set('q', quality.toString());
    if (format === 'webp') url.searchParams.set('format', 'webp');

    // Alternative: If using a CDN (Cloudinary, Imgix, etc.), use their format:
    // return `https://cdn.example.com/w_${width || 'auto'},q_${quality}/${src}`;

    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return src;
  }
};

/**
 * Get optimized image URL for product cards (list views)
 * Uses smaller size for faster loading
 */
export const getProductCardImage = (src: string): string => {
  return optimizeImage(src, {
    width: 400, // Optimal for product cards
    quality: 80, // Slightly lower quality for faster load
    format: 'webp', // Prefer WebP if supported
  });
};

/**
 * Get optimized image URL for product detail (main image)
 * Uses larger size but still optimized
 */
export const getProductDetailImage = (src: string): string => {
  return optimizeImage(src, {
    width: 800, // Larger for detail view
    quality: 85,
    format: 'webp',
  });
};

/**
 * Get optimized image URL for gallery thumbnails
 */
export const getGalleryThumbnail = (src: string): string => {
  return optimizeImage(src, {
    width: 150,
    quality: 75,
    format: 'webp',
  });
};

/**
 * Preload an image to improve perceived performance
 */
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Preload multiple images
 */
export const preloadImages = async (srcs: string[]): Promise<void> => {
  await Promise.allSettled(srcs.map(preloadImage));
};

/**
 * Cache image in browser cache with aggressive caching headers
 * Images are cached by browser automatically, but we can hint for longer cache
 */
export const cacheImage = (src: string): void => {
  if (typeof window === 'undefined') return;
  
  // Create link with preload to cache image
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
  
  // Also preload via Image object (browser cache)
  const img = new Image();
  img.src = src;
};

/**
 * Cache multiple images
 */
export const cacheImages = (srcs: string[]): void => {
  srcs.forEach(cacheImage);
};
