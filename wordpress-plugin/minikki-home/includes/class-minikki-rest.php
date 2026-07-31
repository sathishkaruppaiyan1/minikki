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

		$payload = array(
			'version'           => MINIKKI_HOME_VERSION,
			'updated_at'        => (int) get_option( MINIKKI_HOME_OPTION . '_updated_at', 0 ),
			'topbar'            => $config['topbar'],
			'circle_categories' => self::expand_category_section( $config['circle_categories'] ),
			'shop_by_category'  => self::expand_category_section( $config['shop_by_category'] ),
			'banners'           => array(
				'hero'       => self::expand_banners( $config['banners']['hero'] ),
				'below_hero' => self::expand_banners( $config['banners']['below_hero'] ),
			),
			'new_arrivals'      => self::expand_product_section( $config['new_arrivals'] ),
			'hot_sellers'       => self::expand_product_section( $config['hot_sellers'] ),
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

	/**
	 * Product sections ship the *ordered* ID list. The storefront resolves those
	 * IDs through its existing product pipeline and re-sorts to this order, so
	 * product shaping stays in one place.
	 *
	 * @param array $section Config section.
	 * @return array
	 */
	private static function expand_product_section( $section ) {
		$product_ids = array();

		if ( 'manual' === ( $section['source'] ?? 'tag' ) ) {
			foreach ( (array) ( $section['product_ids'] ?? array() ) as $product_id ) {
				$product_id = (int) $product_id;

				// Drop anything that is no longer a published product.
				if ( $product_id > 0 && 'publish' === get_post_status( $product_id ) ) {
					$product_ids[] = $product_id;
				}
			}
		}

		return array(
			'enabled'       => ! empty( $section['enabled'] ),
			'title'         => $section['title'] ?? '',
			'view_all_link' => '' !== ( $section['view_all_link'] ?? '' ) ? $section['view_all_link'] : '/collections/all',
			'source'        => $section['source'] ?? 'tag',
			'tag'           => $section['tag'] ?? '',
			'product_ids'   => $product_ids,
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
