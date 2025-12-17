import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, Grid3X3, LayoutList, X } from "lucide-react";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useWooCommerceProducts, useWooCommerceCategories } from "@/hooks/useWooCommerce";

type SortOption = "default" | "price-low" | "price-high" | "newest" | "name-asc" | "name-desc";

const Collection = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";

  const [showFilters, setShowFilters] = useState(false);
  const [gridView, setGridView] = useState<"grid" | "list">("grid");
  const [priceRange, setPriceRange] = useState({ min: 0, max: 50000 });
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);

  const { data: categoriesData, isLoading: categoriesLoading } = useWooCommerceCategories();
  const { data: productsData, isLoading: productsLoading } = useWooCommerceProducts({
    category: slug === "all" ? undefined : slug,
    search: searchQuery,
    perPage: 50,
  });

  const categories = categoriesData?.categories || [];
  const rawProducts = productsData?.products || [];
  const isLoading = categoriesLoading || productsLoading;

  // Filter and sort products
  const products = useMemo(() => {
    let filtered = [...rawProducts];

    // Price filter
    filtered = filtered.filter(
      (p) => p.price >= priceRange.min && p.price <= priceRange.max
    );

    // In stock filter
    if (inStockOnly) {
      filtered = filtered.filter((p) => !p.isSoldOut && p.inStock !== false);
    }

    // On sale filter
    if (onSaleOnly) {
      filtered = filtered.filter((p) => p.discount && p.discount > 0);
    }

    // Sorting
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "newest":
        // Assuming newer products have higher IDs
        filtered.sort((a, b) => parseInt(b.id) - parseInt(a.id));
        break;
      default:
        break;
    }

    return filtered;
  }, [rawProducts, priceRange, sortBy, inStockOnly, onSaleOnly]);

  const clearFilters = () => {
    setPriceRange({ min: 0, max: 50000 });
    setInStockOnly(false);
    setOnSaleOnly(false);
    setSortBy("default");
  };

  const category = categories.find(c => c.slug === slug);
  const categoryTitle = searchQuery
    ? `Search results for "${searchQuery}"`
    : category?.name || (slug === "all" ? "All Products" : slug);

  const hasActiveFilters = inStockOnly || onSaleOnly || priceRange.min > 0 || priceRange.max < 50000;

  return (
    <Layout>
      {/* Category Header */}
      <div className="bg-muted py-8 text-center">
        <h1 className="font-heading text-3xl lg:text-4xl">
          {categoryTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Home &gt; {searchQuery ? "Search" : categoryTitle}
        </p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28 space-y-6">
              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}

              <div>
                <h3 className="font-bold mb-3">CATEGORIES</h3>
                {categoriesLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-4 w-24" />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a
                        href="/collections/all"
                        className={`hover:text-primary transition-colors ${
                          slug === "all" ? "text-primary font-bold" : "font-medium"
                        }`}
                      >
                        All Products
                      </a>
                    </li>
                    {categories.map((cat) => (
                      <li key={cat.id}>
                        <a
                          href={`/collections/${cat.slug}`}
                          className={`hover:text-primary transition-colors ${
                            slug === cat.slug ? "text-primary font-bold" : "font-medium"
                          }`}
                        >
                          {cat.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="font-bold mb-3">AVAILABILITY</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                    <Checkbox
                      checked={inStockOnly}
                      onCheckedChange={(checked) => setInStockOnly(checked === true)}
                    />
                    In Stock Only
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                    <Checkbox
                      checked={onSaleOnly}
                      onCheckedChange={(checked) => setOnSaleOnly(checked === true)}
                    />
                    On Sale
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-3">PRICE</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Rs.</span>
                  <input
                    type="number"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: +e.target.value }))}
                    className="w-20 px-2 py-1.5 border border-border text-sm font-medium"
                    placeholder="0"
                  />
                  <span className="text-sm font-medium">to</span>
                  <input
                    type="number"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: +e.target.value }))}
                    className="w-20 px-2 py-1.5 border border-border text-sm font-medium"
                    placeholder="50000"
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden font-bold"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                <span className="text-sm text-muted-foreground font-medium">
                  {products.length} of {rawProducts.length} items
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden lg:flex items-center gap-1">
                  <Button
                    variant={gridView === "grid" ? "secondary" : "ghost"}
                    size="iconSm"
                    onClick={() => setGridView("grid")}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={gridView === "list" ? "secondary" : "ghost"}
                    size="iconSm"
                    onClick={() => setGridView("list")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="text-sm border border-border px-3 py-1.5 bg-background font-medium"
                  >
                    <option value="default">Best Selling</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="newest">Newest</option>
                    <option value="name-asc">Name: A to Z</option>
                    <option value="name-desc">Name: Z to A</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile Filters */}
            {showFilters && (
              <div className="lg:hidden mb-6 p-4 border border-border animate-fade-in">
                <div className="space-y-4">
                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="w-full font-bold"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}

                  <div>
                    <h3 className="font-bold mb-2">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="/collections/all"
                        className={`px-3 py-1.5 border text-sm font-medium transition-colors ${
                          slug === "all"
                            ? "border-primary text-primary bg-primary/10"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        All
                      </a>
                      {categories.map((cat) => (
                        <a
                          key={cat.id}
                          href={`/collections/${cat.slug}`}
                          className={`px-3 py-1.5 border text-sm font-medium transition-colors ${
                            slug === cat.slug
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border hover:border-foreground"
                          }`}
                        >
                          {cat.name}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold mb-2">Availability</h3>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                        <Checkbox
                          checked={inStockOnly}
                          onCheckedChange={(checked) => setInStockOnly(checked === true)}
                        />
                        In Stock
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                        <Checkbox
                          checked={onSaleOnly}
                          onCheckedChange={(checked) => setOnSaleOnly(checked === true)}
                        />
                        On Sale
                      </label>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold mb-2">Price Range</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Rs.</span>
                      <input
                        type="number"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, min: +e.target.value }))}
                        className="w-20 px-2 py-1.5 border border-border text-sm font-medium"
                        placeholder="0"
                      />
                      <span className="text-sm font-medium">to</span>
                      <input
                        type="number"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange(prev => ({ ...prev, max: +e.target.value }))}
                        className="w-20 px-2 py-1.5 border border-border text-sm font-medium"
                        placeholder="50000"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products Grid */}
            {isLoading ? (
              <div className={`grid gap-4 lg:gap-6 ${
                gridView === "grid" 
                  ? "grid-cols-2 md:grid-cols-3" 
                  : "grid-cols-1"
              }`}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[3/4] w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className={`grid gap-4 lg:gap-6 ${
                gridView === "grid" 
                  ? "grid-cols-2 md:grid-cols-3" 
                  : "grid-cols-1"
              }`}>
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {!isLoading && products.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No products found in this category.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Collection;
