# Graph Report - .  (2026-09-19)

## Corpus Check
- 171 files · ~2,08,007 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 931 nodes · 1525 edges · 77 communities detected
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 636 · imports_from: 290 · imports: 282 · calls: 136 · references: 72 · method: 47 · conceptually_related_to: 20 · rationale_for: 15 · implements: 10 · semantically_similar_to: 8 · shares_data_with: 6 · inherits: 3

## God Nodes (most connected - your core abstractions)
1. `cn()` - 46 edges
2. `serve()` - 22 edges
3. `Minikki_Home_Rest` - 19 edges
4. `Button` - 17 edges
5. `Minikki_Home_Config` - 15 edges
6. `attr()` - 14 edges
7. `get()` - 13 edges
8. `esc()` - 11 edges
9. `useCart()` - 10 edges
10. `Product` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Three Idempotent Settlement Paths` --semantically_similar_to--> `Cache-Control no-cache on index.html`  [INFERRED] [semantically similar]
  docs/RAZORPAY_SETUP.md → deploy/README.md
- `Account Icon Options Gallery` --conceptually_related_to--> `Minikki Storefront Shell (index.html)`  [INFERRED]
  public/icon-preview.html → index.html
- `Open Graph Card` --conceptually_related_to--> `Disallowed Transactional/Account Routes`  [INFERRED]
  index.html → public/robots.txt
- `SEO Meta Tags and Canonical` --conceptually_related_to--> `robots.txt Crawl Policy`  [INFERRED]
  index.html → public/robots.txt
- `WebSite JSON-LD SearchAction` --conceptually_related_to--> `Sitemap Reference (minikki.in/sitemap.xml)`  [INFERRED]
  index.html → public/robots.txt

## Hyperedges (group relationships)
- **Three-Path Idempotent Payment Settlement** — razorpay_setup_checkout_tsx, razorpay_setup_create_razorpay_order, razorpay_setup_verify_razorpay_payment, razorpay_setup_razorpay_webhook, razorpay_setup_razorpay_reconcile, razorpay_setup_payment_attempts, razorpay_setup_woocommerce_integration [EXTRACTED 1.00]
- **SPA Deep-Link Fallback Across Hosts** — readme_spa_404_on_refresh, readme_try_files_fallback, readme_cloudpanel_spa_conf, readme_nginx_spa_conf, readme_htaccess_apache, readme_netlify_redirects, readme_vercel_json, readme_php_readfile_workaround [EXTRACTED 1.00]
- **Minikki Search and Social Discovery Surface** — index_seo_meta, index_open_graph, index_twitter_card, index_structured_data_onlinestore, index_structured_data_website, robots_crawl_policy, robots_sitemap_reference [INFERRED 0.85]
- **Minikki Storefront Brand System** — banner_fallback_hero, banner_fallback_brand_identity, size_chart_asset, founder_portrait, new_arrival_banner_placeholder [INFERRED 0.80]
- **Fit and Sizing System** — size_chart_size_scale, size_chart_body_measurements, size_chart_measurement_guidelines, size_chart_garment_lengths [EXTRACTED 1.00]

## Communities

### Community 0 - "Storefront Shell & SEO"
Cohesion: 0.06
Nodes (57): Account Icon Options Gallery, Option 1 - Current Head + Shoulders Icon, Google Fonts (Playfair Display, Outfit, Manrope), logo.png Minikki Mark, Minikki Storefront Shell (index.html), Open Graph Card, React Entry Point /src/main.tsx, SEO Meta Tags and Canonical (+49 more)

### Community 1 - "Shared UI Primitives"
Cohesion: 0.08
Nodes (20): NavLink, NavLinkCompatProps, cn(), Alert, AlertDescription, AlertTitle, alertVariants, Avatar (+12 more)

### Community 2 - "Checkout, Tax & India States"
Cohesion: 0.09
Nodes (26): StockIssue, useCreateOrder(), useWooCommercePaymentGateways(), useWooCommerceTaxConfig(), INDIA_STATE_CODES, toCountryCode(), toIndiaStateCode(), VALID_CODES (+18 more)

### Community 3 - "Sidebar & Responsive Layout"
Cohesion: 0.07
Nodes (28): useIsMobile(), Separator, Sidebar, SidebarContent, SidebarContext, SidebarFooter, SidebarGroup, SidebarGroupAction (+20 more)

### Community 4 - "Toast Notification System"
Cohesion: 0.11
Nodes (24): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+16 more)

### Community 5 - "WordPress Admin JS"
Cohesion: 0.28
Nodes (22): attr(), categorySelect(), checkbox(), esc(), get(), imageField(), initSortables(), loadSavedProducts() (+14 more)

### Community 6 - "App Routing & Pages"
Cohesion: 0.08
Nodes (17): AuthProvider(), Account, Cart, Checkout, Collection, Contact, Index, NotFound (+9 more)

### Community 7 - "Hero Banner & Home Config"
Cohesion: 0.10
Nodes (16): HeroBannerProps, getEndpoint(), HomeBannerItem, HomeCategoryItem, HomeCategorySection, HomeConfig, HomeMenuItem, HomeMobileMenu (+8 more)

### Community 8 - "Edge Function Load Testing"
Cohesion: 0.16
Nodes (15): cache_test(), discover_product_id(), main(), make_request(), print_final_report(), print_header(), print_scenario_report(), Load Test Script for Pixel Perfect Shop - Supabase Edge Functions Tests concurr (+7 more)

### Community 9 - "WP Home REST API"
Cohesion: 0.10
Nodes (1): Minikki_Home_Rest

### Community 10 - "Reviews Slider & Carousel"
Cohesion: 0.14
Nodes (13): fallbackReviews, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+5 more)

### Community 11 - "Razorpay Order Recovery"
Cohesion: 0.23
Nodes (16): Exception, env(), Fatal, fetch_initiations(), http(), load_env_file(), main(), All successful Razorpay order creations since `since_iso`, newest first. (+8 more)

### Community 12 - "Product Detail & Gallery"
Cohesion: 0.14
Nodes (13): useWooCommerceProductById(), useWooCommerceProductGallery(), colorNameToHex, VariationImage, DialogHeader(), DialogTitle, SheetContent, SheetContentProps (+5 more)

### Community 13 - "Search, Contact & Tracking"
Cohesion: 0.17
Nodes (7): useWooCommerceProducts(), OrderStatus, supabase, Input, Label, labelVariants, Textarea

### Community 14 - "WooCommerce API Types"
Cohesion: 0.13
Nodes (12): CategoriesResponse, CreateOrderData, CreateReviewData, fetchPageFromWordPressDirect(), OrderLineItem, PaymentGateway, ProductsParams, ProductsResponse (+4 more)

### Community 15 - "Command Palette"
Cohesion: 0.13
Nodes (12): Command, CommandDialogProps, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+4 more)

### Community 16 - "Edge Function CORS Scaffolding"
Cohesion: 0.13
Nodes (9): corsHeaders, corsHeaders, serve(), corsHeaders, corsHeaders, NotificationPayload, corsHeaders, corsHeaders (+1 more)

### Community 17 - "WP Home Config Sanitization"
Cohesion: 0.13
Nodes (1): Minikki_Home_Config

### Community 18 - "Category Browse & Collection"
Cohesion: 0.20
Nodes (6): useWooCommerceCategories(), useWooCommerceProductsInfinite(), SortOption, Checkbox, Reveal(), Skeleton()

### Community 19 - "Home Rows & Image Optimizer"
Cohesion: 0.18
Nodes (9): HomeProductRowProps, useWooCommerceProductsByIds(), getGalleryThumbnail(), getProductCardImage(), getProductDetailImage(), ImageOptimizeOptions, optimizeImage(), preloadImage() (+1 more)

### Community 20 - "Reels & Social Proof"
Cohesion: 0.15
Nodes (7): reels, useRecentOrdersSocialProof(), LayoutProps, relativeTime(), SocialProofPopup(), OrderDetails, Button

### Community 21 - "Site Footer"
Cohesion: 0.16
Nodes (5): informationLinks, quickShopLinks, AccordionContent, AccordionItem, AccordionTrigger

### Community 22 - "Order History & Cards"
Cohesion: 0.21
Nodes (11): LoginStep, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, InputOTP (+3 more)

### Community 23 - "Buttons, Calendar & Pagination"
Cohesion: 0.16
Nodes (6): ButtonProps, buttonVariants, CalendarProps, PaginationContent, PaginationItem, PaginationLinkProps

### Community 24 - "Brand Assets & Visual Identity"
Cohesion: 0.25
Nodes (14): Premium Anarkali Suits Category, Minikki Brand Identity, Minikki Hero Banner (Fallback), Shop Now Hero CTA, Trust and Value Proposition Badges, Founder-Led Brand Storytelling, Founder Portrait Photo, Best Sellers Click-Through CTA (+6 more)

### Community 25 - "Auth Context & Header"
Cohesion: 0.15
Nodes (5): AuthContext, AuthContextType, useAuth(), User, useWordPressPages()

### Community 26 - "Search Context & Mobile Nav"
Cohesion: 0.15
Nodes (5): SearchContext, SearchContextType, SearchProvider(), useSearch(), NavItem

### Community 27 - "Product Data Models"
Cohesion: 0.19
Nodes (8): categories, products, ProductSectionProps, Category, Product, ProductColor, Variation, VariationImages

### Community 28 - "Edge Function Router"
Cohesion: 0.19
Nodes (11): ANON_KEY, denyIfUnauthorized(), FUNCTIONS, GATED, json(), PORT, routes, sb (+3 more)

### Community 29 - "Account Tabs & Sessions"
Cohesion: 0.21
Nodes (8): getSessionToken(), useUserOrders(), WooCommerceOrder, AccountTab, Step, TabsContent, TabsList, TabsTrigger

### Community 30 - "Form Primitives"
Cohesion: 0.17
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 31 - "Menubar"
Cohesion: 0.17
Nodes (10): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarSubContent (+2 more)

### Community 32 - "Error Boundary"
Cohesion: 0.20
Nodes (5): Component, ErrorBoundary, Props, State, rootElement

### Community 33 - "Product Card & Scroll Reveal"
Cohesion: 0.24
Nodes (7): useScrollReveal(), colorNameToHex, getColorHex(), getColorName(), isProductColor(), ProductCard, ProductCardProps

### Community 34 - "GST Tax Plugin"
Cohesion: 0.31
Nodes (8): minikki_gst_apply_store_settings(), minikki_gst_canonical_rates(), minikki_gst_flush_caches(), minikki_gst_handle_rebuild(), minikki_gst_maybe_rebuild(), minikki_gst_preview_state(), minikki_gst_rebuild_rates(), minikki_gst_render_page()

### Community 35 - "Supabase Generated Types"
Cohesion: 0.18
Nodes (10): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables (+2 more)

### Community 36 - "Chart Primitives"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 37 - "Context Menu"
Cohesion: 0.20
Nodes (8): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuSubContent, ContextMenuSubTrigger

### Community 38 - "Dropdown Menu"
Cohesion: 0.20
Nodes (8): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSubContent, DropdownMenuSubTrigger

### Community 39 - "Cart Drawer & Cart State"
Cohesion: 0.25
Nodes (5): CartContext, CartContextType, CartItem, CartProvider(), useCart()

### Community 40 - "Table Primitives"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 41 - "Quick View Modal"
Cohesion: 0.29
Nodes (4): QuickViewContext, QuickViewContextType, QuickViewProvider(), useQuickView()

### Community 42 - "Query Client & Cache Persistence"
Cohesion: 0.32
Nodes (5): queryClient, CacheData, NON_PERSISTABLE_PREFIXES, persistQueryCache(), restoreQueryCache()

### Community 43 - "Breadcrumb"
Cohesion: 0.25
Nodes (5): Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage

### Community 44 - "Drawer"
Cohesion: 0.25
Nodes (4): DrawerContent, DrawerDescription, DrawerOverlay, DrawerTitle

### Community 45 - "Navigation Menu"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 46 - "Select"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 47 - "Product Cache Edge Function"
Cohesion: 0.25
Nodes (6): corsHeaders, detailCacheHeaders, listCacheHeaders, responseCache, revalidatingKeys, tagSlugCache

### Community 48 - "Wishlist"
Cohesion: 0.33
Nodes (4): useWishlist(), WishlistContext, WishlistContextType, WishlistProvider()

### Community 49 - "WordPress CMS Pages"
Cohesion: 0.33
Nodes (6): useWordPressPageBySlugs(), decodeHtmlEntities(), pageTitles, slugMap, WordPressPage(), WordPressPageProps

### Community 50 - "WP Admin Menu"
Cohesion: 0.29
Nodes (1): Minikki_Home_Admin

### Community 51 - "Payment Attempt Recording"
Cohesion: 0.33
Nodes (4): getSupabaseClient(), NOTE: this function must run with verify_jwt = false (see supabase/config.toml)., recordAttempt(), RECOVERABLE_STATUSES

### Community 52 - "Database Schema"
Cohesion: 0.29
Nodes (6): public.otps, public.payment_attempts, public.payment_initiation_logs, public.product_cache, public.review_media, public.users

### Community 53 - "Toggle & Toggle Group"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 54 - "Guest Order Session Auth"
Cohesion: 0.33
Nodes (4): corsHeaders, hmacHex(), SessionPayload, verifySessionToken()

### Community 55 - "Product Slider & Pricing"
Cohesion: 0.40
Nodes (4): formatPrice(), ProductSliderProps, SliderCard(), getProductPriceDetails()

### Community 56 - "Razorpay Order Creation"
Cohesion: 0.50
Nodes (3): corsHeaders, getSupabaseClient(), logPaymentInitiation()

### Community 57 - "Promo Bar Messaging"
Cohesion: 0.40
Nodes (2): HomeTopbarMessage, FALLBACK_MESSAGES

### Community 58 - "Payment Reconciliation"
Cohesion: 0.40
Nodes (2): ReconcileResult, RECOVERABLE_STATUSES

### Community 59 - "Payment Success Recording"
Cohesion: 0.40
Nodes (2): corsHeaders, RECOVERABLE_STATUSES

### Community 60 - "Slug Lookup Edge Function"
Cohesion: 0.40
Nodes (2): corsHeaders, noCacheHeaders

### Community 61 - "Storefront Icon Set"
Cohesion: 0.67
Nodes (4): Storefront Header Icon Set, Account User Icon, Shopping Cart Icon, Image Placeholder Graphic

### Community 62 - "Payment Initiation Logging"
Cohesion: 0.67
Nodes (3): corsHeaders, getSupabaseClient(), logPaymentInitiation()

### Community 63 - "Conflicting Brand Logos"
Cohesion: 0.67
Nodes (4): Black Lovers Brand Identity, Black Lovers Crown Logo (WebP), Minikki Circular Logo Badge, Black Lovers Crown Logo (New PNG)

### Community 64 - "Badge"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 65 - "Session Token Verification"
Cohesion: 0.67
Nodes (3): corsHeaders, hmacHex(), verifySessionToken()

### Community 66 - "OTP Verification"
Cohesion: 0.50
Nodes (2): corsHeaders, VerifyOTPPayload

### Community 67 - "OTP Send"
Cohesion: 0.50
Nodes (2): corsHeaders, SendOTPPayload

### Community 68 - "Store Settings Lookup"
Cohesion: 0.50
Nodes (2): corsHeaders, SettingRow

### Community 69 - "OTP Auth Migration"
Cohesion: 0.67
Nodes (2): otps, users

### Community 70 - "OTP Send Payload"
Cohesion: 0.67
Nodes (2): corsHeaders, SendOTPPayload

### Community 71 - "Supabase Client Bootstrap"
Cohesion: 0.67
Nodes (1): corsHeaders

### Community 72 - "Plugin Zip Build Script"
Cohesion: 0.67
Nodes (1): Packages each plugin folder into a WordPress-uploadable zip.  Built with Python'

### Community 73 - "Review Media Migration"
Cohesion: 1.00
Nodes (1): public.review_media

### Community 74 - "Product Cache Migration"
Cohesion: 1.00
Nodes (1): product_cache

### Community 75 - "Payment Initiation Log Migration"
Cohesion: 1.00
Nodes (1): public.payment_initiation_logs

### Community 76 - "Payment Attempts Migration"
Cohesion: 1.00
Nodes (1): public.payment_attempts

## Ambiguous Edges - Review These
- `Founder Portrait Photo` → `Minikki Hero Banner (Fallback)`  [AMBIGUOUS]
  public/founder.jpg · relation: conceptually_related_to
- `Account Icon Options Gallery` → `Disallowed Transactional/Account Routes`  [AMBIGUOUS]
  public/icon-preview.html · relation: conceptually_related_to
- `Minikki Circular Logo Badge` → `Black Lovers Brand Identity`  [AMBIGUOUS]
  public/logo.png · relation: conceptually_related_to
- `New Arrival Banner (Best Sellers Placeholder)` → `Minikki Brand Identity`  [AMBIGUOUS]
  public/new_arrival_banner.jpg · relation: conceptually_related_to

## Knowledge Gaps
- **330 isolated node(s):** `Load Test Script for Pixel Perfect Shop - Supabase Edge Functions Tests concurr`, `Fetch the listing page and extract a real product ID.`, `Prime each endpoint's cache with a single sequential request.`, `Fire 10 rapid requests to the same endpoint to verify cache hits.`, `Read KEY=value lines from a config file into os.environ (no overwrite).` (+325 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `WP Home REST API`** (1 nodes): `Minikki_Home_Rest`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `WP Home Config Sanitization`** (1 nodes): `Minikki_Home_Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `WP Admin Menu`** (1 nodes): `Minikki_Home_Admin`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Promo Bar Messaging`** (2 nodes): `HomeTopbarMessage`, `FALLBACK_MESSAGES`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Payment Reconciliation`** (2 nodes): `ReconcileResult`, `RECOVERABLE_STATUSES`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Payment Success Recording`** (2 nodes): `corsHeaders`, `RECOVERABLE_STATUSES`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Slug Lookup Edge Function`** (2 nodes): `corsHeaders`, `noCacheHeaders`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OTP Verification`** (2 nodes): `corsHeaders`, `VerifyOTPPayload`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OTP Send`** (2 nodes): `corsHeaders`, `SendOTPPayload`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Store Settings Lookup`** (2 nodes): `corsHeaders`, `SettingRow`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OTP Auth Migration`** (2 nodes): `otps`, `users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OTP Send Payload`** (2 nodes): `corsHeaders`, `SendOTPPayload`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Client Bootstrap`** (1 nodes): `corsHeaders`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Plugin Zip Build Script`** (1 nodes): `Packages each plugin folder into a WordPress-uploadable zip.  Built with Python'`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Review Media Migration`** (1 nodes): `public.review_media`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Product Cache Migration`** (1 nodes): `product_cache`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Payment Initiation Log Migration`** (1 nodes): `public.payment_initiation_logs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Payment Attempts Migration`** (1 nodes): `public.payment_attempts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Founder Portrait Photo` and `Minikki Hero Banner (Fallback)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Account Icon Options Gallery` and `Disallowed Transactional/Account Routes`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Minikki Circular Logo Badge` and `Black Lovers Brand Identity`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `New Arrival Banner (Best Sellers Placeholder)` and `Minikki Brand Identity`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `cn()` connect `Shared UI Primitives` to `Site Footer`, `Checkout, Tax & India States`, `Badge`, `Breadcrumb`, `Buttons, Calendar & Pagination`, `Order History & Cards`, `Reviews Slider & Carousel`, `Chart Primitives`, `Category Browse & Collection`, `Command Palette`, `Context Menu`, `Drawer`, `Dropdown Menu`, `Form Primitives`, `Search, Contact & Tracking`, `Menubar`, `Navigation Menu`, `Select`, `Sidebar & Responsive Layout`, `Product Detail & Gallery`, `Table Primitives`, `Account Tabs & Sessions`, `Toast Notification System`, `Toggle & Toggle Group`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `Button` connect `Reels & Social Proof` to `Cart Drawer & Cart State`, `Auth Context & Header`, `Account Tabs & Sessions`, `Checkout, Tax & India States`, `Category Browse & Collection`, `Search, Contact & Tracking`, `Order History & Cards`, `Product Detail & Gallery`, `Wishlist`, `Product Card & Scroll Reveal`, `Quick View Modal`, `Buttons, Calendar & Pagination`, `Reviews Slider & Carousel`, `Sidebar & Responsive Layout`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `Load Test Script for Pixel Perfect Shop - Supabase Edge Functions Tests concurr`, `Fetch the listing page and extract a real product ID.`, `Prime each endpoint's cache with a single sequential request.` to the rest of the system?**
  _330 weakly-connected nodes found - possible documentation gaps or missing edges._