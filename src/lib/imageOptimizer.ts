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
 * WebP copies made by the "Minikki Images" WordPress plugin
 * (wordpress-plugin/minikki-images). Keep the folder and widths in sync with
 * Minikki_Images_Generator::WIDTHS:
 *   /wp-content/uploads/2026/10/photo.jpeg
 *   -> /wp-content/uploads/minikki-img/2026/10/photo.jpeg.800.webp
 *
 * Neither WordPress nor nginx understands ?w=/&format= query params, so the
 * old approach downloaded the full original for every thumbnail.
 */
const VARIANT_DIR = 'minikki-img';
const VARIANT_WIDTHS = [150, 400, 800, 1600];
const UPLOADS_MARKER = '/wp-content/uploads/';
const VARIANT_PATTERN = new RegExp(
  `${UPLOADS_MARKER}${VARIANT_DIR}/(.+\\.(?:jpe?g|png))\\.\\d+\\.webp$`,
  'i'
);

/**
 * Original upload URL for a WebP copy URL, or null if `src` isn't one.
 * Used to fall back when a copy hasn't been generated yet.
 */
export const originalFromVariant = (src: string): string | null => {
  const match = src.match(VARIANT_PATTERN);
  if (!match) return null;
  return src.slice(0, match.index) + UPLOADS_MARKER + match[1];
};

/**
 * Point an uploads image URL at its pre-generated WebP copy of the smallest
 * width that still covers `width`. Anything else is returned unchanged.
 */
export const optimizeImage = (
  src: string,
  options: ImageOptimizeOptions = {}
): string => {
  if (!src || src.startsWith('/') || src.startsWith('data:')) {
    return src; // Local or data URLs - return as-is
  }

  const { width } = options;
  if (!width) return src;

  try {
    const url = new URL(src);
    const markerAt = url.pathname.indexOf(UPLOADS_MARKER);
    if (markerAt === -1) return src;

    const relative = url.pathname.slice(markerAt + UPLOADS_MARKER.length);
    if (relative.startsWith(`${VARIANT_DIR}/`) || !/\.(jpe?g|png)$/i.test(relative)) {
      return src;
    }

    const variantWidth =
      VARIANT_WIDTHS.find((w) => w >= width) ?? VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1];

    url.pathname = `${url.pathname.slice(0, markerAt)}${UPLOADS_MARKER}${VARIANT_DIR}/${relative}.${variantWidth}.webp`;
    url.search = '';
    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return src;
  }
};

/**
 * When a WebP copy is missing (e.g. an image uploaded before the plugin's
 * backfill reached it), swap the <img> — and any <source> in its <picture> —
 * back to the original upload before the component's own onError shows a
 * placeholder. Call once at startup.
 */
export const installImageFallback = (): void => {
  if (typeof window === 'undefined') return;

  window.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;

      const original = originalFromVariant(img.currentSrc || img.src);
      if (!original) return;

      // Capture phase on window runs before React's onError on the element;
      // stopping here keeps that handler from replacing the image with a placeholder.
      event.stopImmediatePropagation();

      // A srcset lists several copies of one upload; collapse it to the original.
      const srcsetOriginal = (srcset: string) =>
        originalFromVariant(srcset.trim().split(/\s+/)[0] ?? '');

      const picture = img.parentElement;
      if (picture instanceof HTMLPictureElement) {
        picture.querySelectorAll('source').forEach((source) => {
          const sourceOriginal = srcsetOriginal(source.srcset);
          if (sourceOriginal) source.srcset = sourceOriginal;
        });
      }
      if (img.srcset) {
        img.srcset = srcsetOriginal(img.srcset) ?? original;
      }
      img.src = originalFromVariant(img.src) ?? original;
    },
    true
  );
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
 * Full-width homepage banners (desktop) and their mobile versions.
 */
export const getBannerImage = (src: string): string =>
  optimizeImage(src, { width: 1600 });

export const getMobileBannerImage = (src: string): string =>
  optimizeImage(src, { width: 800 });

/**
 * Category tiles and circles.
 */
export const getCategoryImage = (src: string): string =>
  optimizeImage(src, { width: 400 });

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
