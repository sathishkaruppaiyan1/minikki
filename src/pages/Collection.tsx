import { useState } from "react";
import { useParams } from "react-router-dom";
import { SlidersHorizontal, Grid3X3, LayoutList, ChevronDown } from "lucide-react";
import Layout from "@/components/layout/Layout";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { products, categories } from "@/data/products";

const Collection = () => {
  const { slug } = useParams();
  const [showFilters, setShowFilters] = useState(false);
  const [gridView, setGridView] = useState<"grid" | "list">("grid");
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });

  const category = categories.find(c => c.slug === slug);
  const filteredProducts = slug === "all" 
    ? products 
    : products.filter(p => p.category === slug);

  const categoryTitle = category?.name || (slug === "all" ? "All Products" : slug);

  return (
    <Layout>
      {/* Category Header */}
      <div className="bg-muted py-8 text-center">
        <h1 className="font-heading text-3xl lg:text-4xl font-semibold">
          {categoryTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Home &gt; {categoryTitle}
        </p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div>
                <h3 className="font-semibold mb-3">CATEGORIES</h3>
                <ul className="space-y-2 text-sm">
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <a
                        href={`/collections/${cat.slug}`}
                        className={`hover:text-primary transition-colors ${
                          slug === cat.slug ? "text-primary font-medium" : ""
                        }`}
                      >
                        {cat.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-3">AVAILABILITY</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox />
                    In Stock
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox />
                    Out of Stock
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">PRICE</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm">₹</span>
                  <input
                    type="number"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: +e.target.value }))}
                    className="w-20 px-2 py-1 border border-border text-sm"
                    placeholder="0"
                  />
                  <span className="text-sm">to</span>
                  <input
                    type="number"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: +e.target.value }))}
                    className="w-20 px-2 py-1 border border-border text-sm"
                    placeholder="10000"
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
                  className="lg:hidden"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                <span className="text-sm text-muted-foreground">
                  {filteredProducts.length} items
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
                  <select className="text-sm border border-border px-3 py-1.5 bg-background">
                    <option>Best selling</option>
                    <option>Price: Low to High</option>
                    <option>Price: High to Low</option>
                    <option>Newest</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile Filters */}
            {showFilters && (
              <div className="lg:hidden mb-6 p-4 border border-border animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <a
                          key={cat.id}
                          href={`/collections/${cat.slug}`}
                          className={`px-3 py-1 border text-sm transition-colors ${
                            slug === cat.slug
                              ? "border-primary text-primary"
                              : "border-border hover:border-foreground"
                          }`}
                        >
                          {cat.name}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products Grid */}
            <div className={`grid gap-4 lg:gap-6 ${
              gridView === "grid" 
                ? "grid-cols-2 md:grid-cols-3" 
                : "grid-cols-1"
            }`}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {filteredProducts.length === 0 && (
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
