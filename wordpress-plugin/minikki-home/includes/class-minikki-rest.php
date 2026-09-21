<?php
/**
 * REST API surface.
 *
 * Public:
 *   GET /wp-json/minikki/v1/home            → the whole homepage config
 *
 * Admin-only (used by the settings screen):
 *   GET /wp-json/minikki/v1/admin/categories
 *   GET /wp-json/minikki/v1/admin/products?q=&ids=
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Minikki_Home_Rest {

	const NAMESPACE_V1 = 'minikki/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes() {
		register_rest_route(
			self::NAMESPACE_V1,
			'/home',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_home' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/admin/categories',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_admin_categories' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/admin/menus',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_admin_menus' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/admin/pages',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_admin_pages' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/admin/products',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_admin_products' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);
	}

	/**
	 * @return bool
	 */
	public static function can_manage() {
		return current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' );
	}

	/**
	 * Public homepage config. The storefront lives on another origin, so this
	 * response is explicitly CORS-open (it contains no private data).
	 *
	 * @return WP_REST_Response
	 */
	public static function get_home() {
		$config = Minikki_Home_Config::get();

		$updated_at    = (int) get_option( MINIKKI_HOME_OPTION . '_updated_at', 0 );
		$catalog_stamp = Minikki_Home_Config::catalog_stamp();

		$sections = self::product_sections_with_products( $config, $updated_at . ':' . $catalog_stamp );

		$payload = array(
			'version'           => MINIKKI_HOME_VERSION,
			'updated_at'        => $updated_at,
			// Bumped on price edits; the storefront keys its homepage cache on the
			// later of the two so a price change invalidates cached rows.
			'catalog_updated_at' => $catalog_stamp,
			'topbar'            => $config['topbar'],
			'circle_categories' => self::expand_category_section( $config['circle_categories'] ),
			'shop_by_category'  => self::expand_category_section( $config['shop_by_category'] ),
			'banners'           => self::expand_banner_slots( $config['banners'] ),
			'sections'          => $sections,
			// Legacy mirrors so an older storefront build keeps rendering.
			'new_arrivals'      => self::find_section( $sections, 'new_arrivals' ),
			'hot_sellers'       => self::find_section( $sections, 'hot_sellers' ),
			'reviews'           => self::expand_reviews( $config['reviews'] ),
			'mobile_menu'       => self::expand_mobile_menu( $config['mobile_menu'] ),
		);

		$response = new WP_REST_Response( $payload, 200 );
		$response->header( 'Access-Control-Allow-Origin', '*' );
		$response->header( 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300' );

		return $response;
	}

	/**
	 * Resolve each picked category to name / slug / image so the storefront
	 * renders straight from this payload with no extra lookups.
	 *
	 * `source: auto` returns an empty item list on purpose — the storefront
	 * then falls back to its normal "all WooCommerce categories" behaviour.
	 *
	 * @param array $section Config section.
	 * @return array
	 */
	private static function expand_category_section( $section ) {
		$out = array(
			'enabled' => ! empty( $section['enabled'] ),
			'source'  => $section['source'] ?? 'auto',
			'items'   => array(),
		);

		if ( isset( $section['title'] ) ) {
			$out['title'] = $section['title'];
		}

		if ( 'manual' !== $out['source'] ) {
			return $out;
		}

		foreach ( (array) ( $section['items'] ?? array() ) as $item ) {
			if ( empty( $item['enabled'] ) ) {
				continue;
			}

			$term = get_term( (int) $item['category_id'], 'product_cat' );

			if ( ! $term || is_wp_error( $term ) ) {
				continue; // Category was deleted in Woo — skip rather than render a broken tile.
			}

			$image = $item['image'] ?? '';

			if ( '' === $image ) {
				$thumbnail_id = get_term_meta( $term->term_id, 'thumbnail_id', true );
				if ( $thumbnail_id ) {
					$image = wp_get_attachment_url( (int) $thumbnail_id );
				}
			}

			$out['items'][] = array(
				'id'    => (string) $term->term_id,
				'name'  => '' !== ( $item['label'] ?? '' ) ? $item['label'] : $term->name,
				'slug'  => $term->slug,
				'image' => $image ? $image : '',
				'link'  => '' !== ( $item['link'] ?? '' ) ? $item['link'] : '/collections/' . $term->slug,
				'count' => (int) $term->count,
			);
		}

		return $out;
	}

	/**
	 * Both banner slots, each gated by its own switch.
	 *
	 * A hidden slot ships as an EMPTY list as well as `*_enabled: false`. The
	 * flags are what a current storefront reads, but emptying the list is what
	 * makes an older build — which knows nothing about the flags — hide the
	 * strip too. Absent flag means ON, matching the sanitiser.
	 *
	 * @param array $banners Config `banners` node.
	 * @return array
	 */
	private static function expand_banner_slots( $banners ) {
		$out = array();

		foreach ( array( 'hero', 'below_hero' ) as $slot ) {
			$flag    = $slot . '_enabled';
			$enabled = array_key_exists( $flag, $banners ) ? (bool) $banners[ $flag ] : true;

			$out[ $flag ] = $enabled;
			$out[ $slot ] = $enabled ? self::expand_banners( $banners[ $slot ] ?? array() ) : array();
		}

		return $out;
	}

	/**
	 * One slot's banner rows, skipping any row switched off individually.
	 *
	 * @param array $banners Config rows.
	 * @return array
	 */
	private static function expand_banners( $banners ) {
		$out = array();

		foreach ( (array) $banners as $index => $banner ) {
			if ( empty( $banner['enabled'] ) ) {
				continue;
			}

			$out[] = array(
				'id'           => $index + 1,
				'image'        => $banner['image'] ?? '',
				'mobile_image' => $banner['mobile_image'] ?? '',
				'link'         => '' !== ( $banner['link'] ?? '' ) ? $banner['link'] : '/collections/all',
				'alt'          => $banner['alt'] ?? '',
			);
		}

		return $out;
	}

	/** Transient holding the expanded rows, so products are resolved once per edit, not once per visitor. */
	const SECTIONS_CACHE_KEY = 'minikki_home_sections';

	/**
	 * Safety-net TTL for the rows cache. The version stamp already invalidates
	 * on carousel edits and price changes, but stock is deliberately not in the
	 * stamp (it moves on every order), so a Sold Out badge can lag by this long.
	 * Matches the max-age the Supabase list endpoint used to send.
	 */
	const SECTIONS_CACHE_TTL = 5 * MINUTE_IN_SECONDS;

	/**
	 * Every product row with its card data attached.
	 *
	 * Resolving products here is what lets the storefront render the homepage
	 * from this one response instead of one Supabase edge-function call per row
	 * (ten rows, doubled by CORS preflights, for every visitor). The expansion
	 * is cached in a transient keyed on the version stamp: a Home Builder save or
	 * a price change moves the stamp, and the next request rebuilds it.
	 *
	 * @param array  $config Stored config.
	 * @param string $stamp  Version stamp (`updated_at:catalog_updated_at`).
	 * @return array
	 */
	private static function product_sections_with_products( $config, $stamp ) {
		$cached = get_transient( self::SECTIONS_CACHE_KEY );

		if ( is_array( $cached ) && ( $cached['stamp'] ?? null ) === $stamp && is_array( $cached['sections'] ?? null ) ) {
			return $cached['sections'];
		}

		$sections = array();

		foreach ( (array) $config['product_sections'] as $section ) {
			$expanded = self::expand_product_section( $section );

			// Disabled rows are never rendered, so don't spend queries on them.
			$expanded['products'] = $expanded['enabled'] ? self::resolve_section_products( $expanded ) : array();

			$sections[] = $expanded;
		}

		set_transient(
			self::SECTIONS_CACHE_KEY,
			array(
				'stamp'    => $stamp,
				'sections' => $sections,
			),
			self::SECTIONS_CACHE_TTL
		);

		return $sections;
	}

	/**
	 * Drop the rows cache. Called on config save and catalog bumps so a change
	 * is visible on the very next request rather than after the TTL.
	 */
	public static function flush_sections_cache() {
		delete_transient( self::SECTIONS_CACHE_KEY );
	}

	/**
	 * Fetch the products an expanded row should show, in display order.
	 *
	 * Mirrors what the storefront asked Supabase for: manual rows keep the
	 * curated order, tag/category rows are newest-first and capped at `limit`,
	 * the same ordering the WooCommerce REST list endpoint defaults to.
	 *
	 * @param array $section Expanded section (see expand_product_section).
	 * @return array Card-shaped products.
	 */
	private static function resolve_section_products( $section ) {
		if ( ! function_exists( 'wc_get_products' ) ) {
			return array();
		}

		$args = array(
			'status'  => 'publish',
			'orderby' => 'date',
			'order'   => 'DESC',
			'return'  => 'objects',
		);

		switch ( $section['source'] ) {
			case 'manual':
				if ( empty( $section['product_ids'] ) ) {
					return array();
				}
				$args['include'] = $section['product_ids'];
				$args['limit']   = count( $section['product_ids'] );
				break;

			case 'category':
				if ( '' === $section['category_slug'] ) {
					return array();
				}
				$args['category'] = array( $section['category_slug'] );
				$args['limit']    = $section['limit'];
				break;

			default: // tag
				if ( '' === $section['tag'] ) {
					return array();
				}
				$args['tag']   = array( $section['tag'] );
				$args['limit'] = $section['limit'];
				break;
		}

		$products = wc_get_products( $args );

		if ( empty( $products ) || is_wp_error( $products ) ) {
			return array();
		}

		$cards = array();

		foreach ( $products as $product ) {
			$cards[ $product->get_id() ] = self::format_card_product( $product );
		}

		if ( 'manual' === $section['source'] ) {
			// Re-apply the curated order; anything that failed to load is dropped.
			$ordered = array();
			foreach ( $section['product_ids'] as $product_id ) {
				if ( isset( $cards[ $product_id ] ) ) {
					$ordered[] = $cards[ $product_id ];
				}
			}
			return $ordered;
		}

		return array_values( $cards );
	}

	/**
	 * Shape a product exactly like the Supabase `woocommerce-products`
	 * skip_variations fast path does, so the storefront card components need
	 * no changes. Only what a card reads is included: no descriptions, no
	 * variation data, and at most two images (the card shows the first).
	 *
	 * @param WC_Product $product Product.
	 * @return array
	 */
	private static function format_card_product( $product ) {
		$price   = (float) $product->get_price();
		$regular = $product->get_regular_price();
		$regular = '' !== $regular && null !== $regular ? (float) $regular : null;

		$discount = null;
		if ( $product->is_on_sale() && $regular > 0 ) {
			$discount = (int) round( ( ( $regular - $price ) / $regular ) * 100 );
		}

		$images   = array();
		$image_id = $product->get_image_id();
		if ( $image_id ) {
			$images[] = wp_get_attachment_url( (int) $image_id );
		}
		foreach ( array_slice( (array) $product->get_gallery_image_ids(), 0, 1 ) as $gallery_id ) {
			$images[] = wp_get_attachment_url( (int) $gallery_id );
		}
		$images = array_values( array_filter( $images ) );

		$category = null;
		$terms    = get_the_terms( $product->get_id(), 'product_cat' );
		if ( is_array( $terms ) && ! empty( $terms ) ) {
			$category = $terms[0];
		}

		$stock_status = $product->get_stock_status();
		$stock_qty    = $product->get_stock_quantity();

		$card = array(
			'id'               => (string) $product->get_id(),
			'name'             => $product->get_name(),
			'slug'             => $product->get_slug(),
			'price'            => $price,
			'images'           => $images,
			'colors'           => self::attribute_options( $product, array( 'color', 'colour' ) ),
			'sizes'            => self::attribute_options( $product, array( 'size' ) ),
			'category'         => $category ? $category->name : 'Uncategorized',
			'categorySlug'     => $category ? $category->slug : 'uncategorized',
			'categoryId'       => $category ? (string) $category->term_id : '',
			'isNew'            => $product->is_featured(),
			'isSoldOut'        => 'outofstock' === $stock_status,
			'inStock'          => 'instock' === $stock_status,
			'stockQuantity'    => null === $stock_qty ? null : (int) $stock_qty,
			'description'      => '',
			'shortDescription' => '',
			'sku'              => $product->get_sku(),
			'type'             => $product->get_type(),
			'averageRating'    => (string) $product->get_average_rating(),
			'ratingCount'      => (int) $product->get_rating_count(),
		);

		// Optional on the storefront's Product type: absent, not null, like the
		// edge function's `undefined`.
		if ( null !== $regular ) {
			$card['originalPrice'] = $regular;
		}
		if ( null !== $discount ) {
			$card['discount'] = $discount;
		}

		return $card;
	}

	/**
	 * Option labels of the first attribute whose name matches, e.g. the colour
	 * swatches or size list. Taxonomy attributes store term IDs, so those are
	 * resolved to names the same way the WooCommerce REST API does.
	 *
	 * @param WC_Product $product Product.
	 * @param string[]   $names   Lower-case attribute names to accept.
	 * @return string[]
	 */
	private static function attribute_options( $product, $names ) {
		foreach ( $product->get_attributes() as $attribute ) {
			if ( ! is_object( $attribute ) ) {
				continue;
			}

			$label = strtolower( wc_attribute_label( $attribute->get_name(), $product ) );
			$raw   = strtolower( str_replace( 'pa_', '', $attribute->get_name() ) );

			if ( ! in_array( $label, $names, true ) && ! in_array( $raw, $names, true ) ) {
				continue;
			}

			if ( $attribute->is_taxonomy() ) {
				$terms = wc_get_product_terms( $product->get_id(), $attribute->get_name(), array( 'fields' => 'names' ) );
				return is_array( $terms ) ? array_values( $terms ) : array();
			}

			return array_values( array_map( 'strval', (array) $attribute->get_options() ) );
		}

		return array();
	}

	/**
	 * Product section metadata. Ships the ordered ID list (and the resolved
	 * category slug) so an older storefront build can keep resolving products
	 * through Supabase; product_sections_with_products() adds `products` on top.
	 *
	 * @param array $section Config section.
	 * @return array
	 */
	private static function expand_product_section( $section ) {
		$source      = $section['source'] ?? 'tag';
		$product_ids = array();

		if ( 'manual' === $source ) {
			foreach ( (array) ( $section['product_ids'] ?? array() ) as $product_id ) {
				$product_id = (int) $product_id;

				// Drop anything that is no longer a published product.
				if ( $product_id > 0 && 'publish' === get_post_status( $product_id ) ) {
					$product_ids[] = $product_id;
				}
			}
		}

		// The storefront queries Woo by category slug, so resolve the picked
		// term here rather than making the browser do a second round trip.
		$category_id   = (int) ( $section['category_id'] ?? 0 );
		$category_slug = '';

		if ( 'category' === $source && $category_id > 0 ) {
			$term = get_term( $category_id, 'product_cat' );

			if ( $term && ! is_wp_error( $term ) ) {
				$category_slug = $term->slug;
			} else {
				$category_id = 0; // Category was deleted in Woo.
			}
		}

		return array(
			'id'            => $section['id'] ?? '',
			'enabled'       => ! empty( $section['enabled'] ),
			'title'         => $section['title'] ?? '',
			'view_all_link' => '' !== ( $section['view_all_link'] ?? '' ) ? $section['view_all_link'] : '/collections/all',
			'layout'        => in_array( ( $section['layout'] ?? '' ), array( 'slider', 'grid' ), true ) ? $section['layout'] : 'slider',
			'source'        => $source,
			'tag'           => $section['tag'] ?? '',
			'category_id'   => $category_id,
			'category_slug' => $category_slug,
			'product_ids'   => $product_ids,
			'limit'         => max( 1, min( 40, (int) ( $section['limit'] ?? 12 ) ) ),
		);
	}

	/**
	 * @param array  $sections Expanded rows.
	 * @param string $id       Row id to look for.
	 * @return array The matching row, or a disabled placeholder.
	 */
	private static function find_section( $sections, $id ) {
		foreach ( $sections as $section ) {
			if ( ( $section['id'] ?? '' ) === $id ) {
				return $section;
			}
		}

		return array(
			'id'            => $id,
			'enabled'       => false,
			'title'         => '',
			'view_all_link' => '/collections/all',
			'layout'        => 'slider',
			'source'        => 'tag',
			'tag'           => '',
			'category_id'   => 0,
			'category_slug' => '',
			'product_ids'   => array(),
			'limit'         => 12,
			'products'      => array(),
		);
	}

	/**
	 * @param array $reviews Config section.
	 * @return array
	 */
	private static function expand_reviews( $reviews ) {
		$items = array();

		foreach ( (array) ( $reviews['items'] ?? array() ) as $index => $item ) {
			if ( empty( $item['enabled'] ) ) {
				continue;
			}

			$items[] = array(
				'id'     => $index + 1,
				'name'   => $item['name'] ?? '',
				'text'   => $item['text'] ?? '',
				'rating' => (int) ( $item['rating'] ?? 5 ),
				'image'  => $item['image'] ?? '',
				'link'   => $item['link'] ?? '',
			);
		}

		return array(
			'enabled'  => ! empty( $reviews['enabled'] ),
			'title'    => $reviews['title'] ?? '',
			'subtitle' => $reviews['subtitle'] ?? '',
			'items'    => $items,
		);
	}

	/**
	 * Mobile hamburger menu.
	 *
	 * `source: auto` returns every published page — identical to what the
	 * storefront did before this plugin existed — so switching to `manual` is
	 * an opt-in.
	 *
	 * @param array $menu Config section.
	 * @return array
	 */
	private static function expand_mobile_menu( $menu ) {
		$out = array(
			'enabled' => ! empty( $menu['enabled'] ),
			'title'   => $menu['title'] ?? 'Menu',
			'source'  => $menu['source'] ?? 'wp_menu',
			'items'   => array(),
		);

		if ( 'wp_menu' === $out['source'] ) {
			$out['items'] = self::expand_wp_nav_menu( (int) ( $menu['menu_id'] ?? 0 ) );

			return $out;
		}

		if ( 'manual' !== $out['source'] ) {
			return $out;
		}

		foreach ( (array) ( $menu['items'] ?? array() ) as $index => $item ) {
			if ( empty( $item['enabled'] ) ) {
				continue;
			}

			$label = $item['label'] ?? '';
			$link  = '';

			if ( 'page' === $item['type'] ) {
				$page = get_post( (int) $item['page_id'] );

				if ( ! $page || 'publish' !== $page->post_status ) {
					continue; // Page deleted or unpublished — don't render a dead link.
				}

				$label = '' !== $label ? $label : $page->post_title;
				$link  = '/page/' . $page->post_name;
			} elseif ( 'category' === $item['type'] ) {
				$term = get_term( (int) $item['category_id'], 'product_cat' );

				if ( ! $term || is_wp_error( $term ) ) {
					continue;
				}

				$label = '' !== $label ? $label : $term->name;
				$link  = '/collections/' . $term->slug;
			} else {
				$link = $item['url'] ?? '';
			}

			if ( '' === $label || '' === $link ) {
				continue;
			}

			$out['items'][] = array(
				'id'    => $index + 1,
				'label' => $label,
				'link'  => $link,
				'type'  => $item['type'],
			);
		}

		return $out;
	}

	/**
	 * Resolve the menu to read: an explicit choice, else whatever the theme has
	 * assigned to a location, else the first menu that exists.
	 *
	 * @param int $menu_id Configured menu ID (0 = auto).
	 * @return int Menu term ID, or 0 when the site has no menus.
	 */
	private static function resolve_nav_menu_id( $menu_id ) {
		if ( $menu_id > 0 && is_nav_menu( $menu_id ) ) {
			return $menu_id;
		}

		$locations = get_nav_menu_locations();

		if ( is_array( $locations ) ) {
			// Prefer the usual primary-ish locations before falling back.
			foreach ( array( 'primary', 'main', 'menu-1', 'primary-menu' ) as $slug ) {
				if ( ! empty( $locations[ $slug ] ) && is_nav_menu( $locations[ $slug ] ) ) {
					return (int) $locations[ $slug ];
				}
			}

			foreach ( $locations as $assigned ) {
				if ( ! empty( $assigned ) && is_nav_menu( $assigned ) ) {
					return (int) $assigned;
				}
			}
		}

		$menus = wp_get_nav_menus();

		if ( ! empty( $menus ) && ! is_wp_error( $menus ) ) {
			return (int) $menus[0]->term_id;
		}

		return 0;
	}

	/**
	 * Read an Appearance → Menus nav menu and translate each item into a
	 * storefront route. WordPress stores absolute wp-site URLs, which are wrong
	 * for the React app, so links are rebuilt from the item's object type.
	 *
	 * @param int $menu_id Configured menu ID (0 = auto-detect).
	 * @return array
	 */
	private static function expand_wp_nav_menu( $menu_id ) {
		$resolved = self::resolve_nav_menu_id( $menu_id );

		if ( ! $resolved ) {
			return array();
		}

		$menu_items = wp_get_nav_menu_items( $resolved, array( 'update_post_term_cache' => false ) );

		if ( empty( $menu_items ) || is_wp_error( $menu_items ) ) {
			return array();
		}

		$home = untrailingslashit( home_url() );
		$out  = array();

		foreach ( $menu_items as $item ) {
			$link = '';

			if ( 'taxonomy' === $item->type && 'product_cat' === $item->object ) {
				$term = get_term( (int) $item->object_id, 'product_cat' );
				if ( $term && ! is_wp_error( $term ) ) {
					$link = '/collections/' . $term->slug;
				}
			} elseif ( 'post_type' === $item->type && 'page' === $item->object ) {
				$page = get_post( (int) $item->object_id );
				if ( $page && 'publish' === $page->post_status ) {
					$link = '/page/' . $page->post_name;
				}
			} elseif ( 'post_type' === $item->type && 'product' === $item->object ) {
				$link = '/product/' . (int) $item->object_id;
			} elseif ( 'post_type_archive' === $item->type && 'product' === $item->object ) {
				$link = '/collections/all';
			} else {
				// Custom link. Strip the WordPress origin so it stays inside the
				// storefront; genuinely external URLs are passed through as-is.
				$url = (string) $item->url;

				if ( '' !== $url && 0 === strpos( $url, $home ) ) {
					$path = substr( $url, strlen( $home ) );
					$link = '' === $path || '/' === $path ? '/' : $path;
				} else {
					$link = $url;
				}
			}

			if ( '' === $link ) {
				continue; // Target was deleted or unpublished.
			}

			$label = $item->title;

			if ( '' === $label ) {
				continue;
			}

			$out[] = array(
				'id'     => (int) $item->ID,
				'label'  => $label,
				'link'   => $link,
				'type'   => $item->type,
				'parent' => (int) $item->menu_item_parent,
			);
		}

		return $out;
	}

	/**
	 * Nav menus registered on the site, for the admin picker.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_admin_menus() {
		$menus     = wp_get_nav_menus();
		$locations = get_nav_menu_locations();
		$assigned  = is_array( $locations ) ? array_map( 'intval', array_values( $locations ) ) : array();
		$out       = array();

		if ( ! empty( $menus ) && ! is_wp_error( $menus ) ) {
			foreach ( $menus as $menu ) {
				$out[] = array(
					'id'       => (int) $menu->term_id,
					'name'     => $menu->name,
					'count'    => (int) $menu->count,
					'assigned' => in_array( (int) $menu->term_id, $assigned, true ),
				);
			}
		}

		return new WP_REST_Response( array( 'menus' => $out ), 200 );
	}

	/**
	 * Published pages, for the admin menu picker.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_admin_pages() {
		$pages = get_posts(
			array(
				'post_type'      => 'page',
				'post_status'    => 'publish',
				'posts_per_page' => 100,
				'orderby'        => 'title',
				'order'          => 'ASC',
			)
		);

		$out = array();

		foreach ( $pages as $page ) {
			$out[] = array(
				'id'    => $page->ID,
				'title' => $page->post_title,
				'slug'  => $page->post_name,
			);
		}

		return new WP_REST_Response( array( 'pages' => $out ), 200 );
	}

	/**
	 * Every product category, for the admin picker.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_admin_categories() {
		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		if ( is_wp_error( $terms ) ) {
			return new WP_REST_Response( array( 'categories' => array() ), 200 );
		}

		$out = array();

		foreach ( $terms as $term ) {
			$image        = '';
			$thumbnail_id = get_term_meta( $term->term_id, 'thumbnail_id', true );

			if ( $thumbnail_id ) {
				$image = wp_get_attachment_image_url( (int) $thumbnail_id, 'thumbnail' );
			}

			$out[] = array(
				'id'    => $term->term_id,
				'name'  => $term->name,
				'slug'  => $term->slug,
				'count' => (int) $term->count,
				'image' => $image ? $image : '',
			);
		}

		return new WP_REST_Response( array( 'categories' => $out ), 200 );
	}

	/**
	 * Product search for the admin picker. `ids` re-hydrates an already-saved
	 * selection; `q` searches by title/SKU.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function get_admin_products( $request ) {
		$search = sanitize_text_field( (string) $request->get_param( 'q' ) );
		$ids    = (string) $request->get_param( 'ids' );

		$args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 30,
			'orderby'        => 'title',
			'order'          => 'ASC',
		);

		if ( '' !== $ids ) {
			$id_list = array_values( array_filter( array_map( 'intval', explode( ',', $ids ) ) ) );

			if ( empty( $id_list ) ) {
				return new WP_REST_Response( array( 'products' => array() ), 200 );
			}

			$args['post__in']       = $id_list;
			$args['orderby']        = 'post__in';
			$args['posts_per_page'] = count( $id_list );
		} elseif ( '' !== $search ) {
			$args['s'] = $search;
		}

		$query = new WP_Query( $args );
		$out   = array();

		foreach ( $query->posts as $post ) {
			$out[] = self::format_admin_product( $post->ID );
		}

		wp_reset_postdata();

		return new WP_REST_Response( array( 'products' => $out ), 200 );
	}

	/**
	 * @param int $product_id Product post ID.
	 * @return array
	 */
	private static function format_admin_product( $product_id ) {
		$image = get_the_post_thumbnail_url( $product_id, 'thumbnail' );
		$price = '';
		$sku   = '';

		if ( function_exists( 'wc_get_product' ) ) {
			$product = wc_get_product( $product_id );

			if ( $product ) {
				$price = wp_strip_all_tags( $product->get_price_html() );
				$sku   = $product->get_sku();
			}
		}

		return array(
			'id'    => (int) $product_id,
			'name'  => get_the_title( $product_id ),
			'image' => $image ? $image : '',
			'price' => $price,
			'sku'   => $sku,
		);
	}
}
