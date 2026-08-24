<?php
/**
 * Configuration schema: defaults, read, sanitise, save.
 *
 * The whole homepage config lives in one wp_options row so the public REST
 * endpoint is a single DB read.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Minikki_Home_Config {

	/**
	 * Default configuration. Mirrors what the storefront renders today, so a
	 * fresh install looks identical to the current hardcoded homepage.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'topbar'            => array(
				'enabled'    => true,
				'mode'       => 'scroll', // scroll | static
				'speed'      => 25,       // seconds for one full loop
				'background' => '',       // empty = inherit theme styling
				'color'      => '',
				'messages'   => array(
					array(
						'text' => 'Welcome to Minikki',
						'link' => '',
					),
				),
			),
			'circle_categories' => array(
				'enabled' => true,
				'source'  => 'auto', // auto = all WooCommerce categories, manual = the curated list below
				'items'   => array(),
			),
			'shop_by_category'  => array(
				'enabled' => true,
				'title'   => 'Shop By Category',
				'source'  => 'auto',
				'items'   => array(),
			),
			'banners'           => array(
				// Whole-strip switches. Turning one off hides that slot on the
				// storefront without deleting the banners inside it.
				'hero_enabled'       => true,
				'below_hero_enabled' => true,
				'hero'               => array(),
				'below_hero'         => array(),
			),
			// Ordered product rows. The first two are the original New Arrivals
			// and Hot Sellers; any number of extra rows can be added in the
			// admin screen and they all render the same way.
			'product_sections'  => array(
				self::default_product_section( 'new_arrivals', 'New Arrivals', 'new-arrivals' ),
				self::default_product_section( 'hot_sellers', 'Hot Sellers', 'hot-sellers' ),
			),
			'reviews'           => array(
				'enabled'  => true,
				'title'    => 'MINIKKI x YOU',
				'subtitle' => 'Happy Minikki Family',
				'items'    => array(),
			),
			'mobile_menu'       => array(
				'enabled' => true,
				'title'   => 'Menu',
				// wp_menu  = an Appearance → Menus nav menu (the default; this is
				//            what the theme itself uses)
				// auto     = every published WordPress page (the old behaviour)
				// manual   = the curated list below
				'source'  => 'wp_menu',
				'menu_id' => 0, // 0 = whichever menu the theme has assigned, else the first one
				'items'   => array(),
			),
		);
	}

	/**
	 * Blank product row.
	 *
	 * @param string $id    Stable key used by the storefront and by the legacy mirrors.
	 * @param string $title Heading.
	 * @param string $tag   Default product tag for the automatic source.
	 * @return array
	 */
	public static function default_product_section( $id = '', $title = 'Products', $tag = '' ) {
		return array(
			'id'            => '' !== $id ? $id : 'section_' . wp_generate_password( 6, false, false ),
			'enabled'       => true,
			'title'         => $title,
			'view_all_link' => '/collections/all',
			'layout'        => 'slider', // slider | grid
			// tag      = every product carrying a tag
			// category = every product in a WooCommerce category
			// manual   = exactly the products picked below, in that order
			'source'        => 'tag',
			'tag'           => $tag,
			'category_id'   => 0,
			'product_ids'   => array(),
			'limit'         => 12,
		);
	}

	/**
	 * Stored config merged over defaults (so new keys added by an update are
	 * always present).
	 *
	 * @return array
	 */
	public static function get() {
		$stored = get_option( MINIKKI_HOME_OPTION, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$config = self::defaults();

		foreach ( $config as $section => $section_defaults ) {
			if ( ! isset( $stored[ $section ] ) || ! is_array( $stored[ $section ] ) ) {
				continue;
			}

			// Ordered lists are replaced wholesale — array_merge would append
			// the stored rows after the defaults instead of replacing them.
			if ( self::is_list( $section_defaults ) ) {
				$config[ $section ] = $stored[ $section ];
				continue;
			}

			$config[ $section ] = array_merge( $section_defaults, $stored[ $section ] );
		}

		// Upgrade from the pre-1.2 shape, where the two rows were separate keys.
		if ( ! isset( $stored['product_sections'] ) && ( isset( $stored['new_arrivals'] ) || isset( $stored['hot_sellers'] ) ) ) {
			$config['product_sections'] = self::migrate_legacy_sections( $stored );
		}

		// Always hand back fully-formed rows, even if the option predates a field.
		$config['product_sections'] = array_map(
			static function ( $section ) {
				return array_merge( self::default_product_section(), is_array( $section ) ? $section : array() );
			},
			(array) $config['product_sections']
		);

		return $config;
	}

	/**
	 * Turns the old `new_arrivals` / `hot_sellers` option keys into two rows of
	 * the new ordered list, preserving every setting the store already had.
	 *
	 * @param array $stored Raw stored option.
	 * @return array
	 */
	private static function migrate_legacy_sections( $stored ) {
		$sections = array();

		$legacy = array(
			'new_arrivals' => array( 'New Arrivals', 'new-arrivals' ),
			'hot_sellers'  => array( 'Hot Sellers', 'hot-sellers' ),
		);

		foreach ( $legacy as $key => $meta ) {
			$base = self::default_product_section( $key, $meta[0], $meta[1] );

			if ( isset( $stored[ $key ] ) && is_array( $stored[ $key ] ) ) {
				$base = array_merge( $base, $stored[ $key ] );
				$base['id'] = $key; // Never let a stored value steal the built-in key.
			}

			$sections[] = $base;
		}

		return $sections;
	}

	/**
	 * @param mixed $value Value to test.
	 * @return bool True when $value is a zero-indexed list.
	 */
	private static function is_list( $value ) {
		if ( ! is_array( $value ) ) {
			return false;
		}

		return array() === $value || array_keys( $value ) === range( 0, count( $value ) - 1 );
	}

	/**
	 * Persist a sanitised config.
	 *
	 * @param array $raw Untrusted input.
	 * @return array The sanitised config that was saved.
	 */
	public static function save( $raw ) {
		$clean = self::sanitize( $raw );

		update_option( MINIKKI_HOME_OPTION, $clean );
		update_option( MINIKKI_HOME_OPTION . '_updated_at', time() );

		return $clean;
	}

	/**
	 * Sanitise every field. Anything unrecognised is dropped.
	 *
	 * @param array $raw Untrusted input.
	 * @return array
	 */
	public static function sanitize( $raw ) {
		$defaults = self::defaults();
		$raw      = is_array( $raw ) ? $raw : array();

		$out = array();

		// --- Announcement / top bar -----------------------------------------
		$topbar          = isset( $raw['topbar'] ) && is_array( $raw['topbar'] ) ? $raw['topbar'] : array();
		$out['topbar']   = array(
			'enabled'    => ! empty( $topbar['enabled'] ),
			'mode'       => in_array( ( $topbar['mode'] ?? '' ), array( 'scroll', 'static' ), true ) ? $topbar['mode'] : 'scroll',
			'speed'      => max( 5, min( 120, (int) ( $topbar['speed'] ?? 25 ) ) ),
			'background' => self::sanitize_color( $topbar['background'] ?? '' ),
			'color'      => self::sanitize_color( $topbar['color'] ?? '' ),
			'messages'   => array(),
		);

		$messages = isset( $topbar['messages'] ) && is_array( $topbar['messages'] ) ? $topbar['messages'] : array();
		foreach ( $messages as $message ) {
			if ( ! is_array( $message ) ) {
				continue;
			}
			$text = sanitize_text_field( $message['text'] ?? '' );
			if ( '' === $text ) {
				continue;
			}
			$out['topbar']['messages'][] = array(
				'text' => $text,
				'link' => self::sanitize_link( $message['link'] ?? '' ),
			);
		}

		// --- Category lists (circle strip + Shop By Category grid) -----------
		foreach ( array( 'circle_categories', 'shop_by_category' ) as $key ) {
			$section = isset( $raw[ $key ] ) && is_array( $raw[ $key ] ) ? $raw[ $key ] : array();

			$out[ $key ] = array(
				'enabled' => ! empty( $section['enabled'] ),
				'source'  => in_array( ( $section['source'] ?? '' ), array( 'auto', 'manual' ), true ) ? $section['source'] : 'auto',
				'items'   => self::sanitize_category_items( $section['items'] ?? array() ),
			);

			if ( 'shop_by_category' === $key ) {
				$title = sanitize_text_field( $section['title'] ?? '' );
				$out[ $key ]['title'] = '' !== $title ? $title : $defaults[ $key ]['title'];
			}
		}

		// --- Banners ---------------------------------------------------------
		$banners = isset( $raw['banners'] ) && is_array( $raw['banners'] ) ? $raw['banners'] : array();

		// The two *_enabled flags were added after the first release. A config
		// saved before then has neither key, and treating "absent" as false
		// would silently hide every banner on upgrade — so absent means ON.
		$slot_enabled = static function ( $key ) use ( $banners ) {
			return array_key_exists( $key, $banners ) ? (bool) $banners[ $key ] : true;
		};

		$out['banners'] = array(
			'hero_enabled'       => $slot_enabled( 'hero_enabled' ),
			'below_hero_enabled' => $slot_enabled( 'below_hero_enabled' ),
			'hero'               => self::sanitize_banner_items( $banners['hero'] ?? array() ),
			'below_hero'         => self::sanitize_banner_items( $banners['below_hero'] ?? array() ),
		);

		// --- Product sections ------------------------------------------------
		$out['product_sections'] = self::sanitize_product_sections( $raw['product_sections'] ?? array() );

		if ( empty( $out['product_sections'] ) ) {
			$out['product_sections'] = $defaults['product_sections'];
		}

		// --- Reviews ----------------------------------------------------------
		$reviews        = isset( $raw['reviews'] ) && is_array( $raw['reviews'] ) ? $raw['reviews'] : array();
		$review_title   = sanitize_text_field( $reviews['title'] ?? '' );
		$review_sub     = sanitize_text_field( $reviews['subtitle'] ?? '' );
		$out['reviews'] = array(
			'enabled'  => ! empty( $reviews['enabled'] ),
			'title'    => '' !== $review_title ? $review_title : $defaults['reviews']['title'],
			'subtitle' => '' !== $review_sub ? $review_sub : $defaults['reviews']['subtitle'],
			'items'    => array(),
		);

		$review_items = isset( $reviews['items'] ) && is_array( $reviews['items'] ) ? $reviews['items'] : array();
		foreach ( $review_items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$name = sanitize_text_field( $item['name'] ?? '' );
			$text = sanitize_textarea_field( $item['text'] ?? '' );

			if ( '' === $name && '' === $text ) {
				continue;
			}

			$out['reviews']['items'][] = array(
				'name'      => $name,
				'text'      => $text,
				'rating'    => max( 1, min( 5, (int) ( $item['rating'] ?? 5 ) ) ),
				'image'     => esc_url_raw( $item['image'] ?? '' ),
				'image_id'  => (int) ( $item['image_id'] ?? 0 ),
				'link'      => self::sanitize_link( $item['link'] ?? '' ),
				'enabled'   => ! isset( $item['enabled'] ) || ! empty( $item['enabled'] ),
			);
		}

		// --- Mobile hamburger menu ---------------------------------------------
		$menu               = isset( $raw['mobile_menu'] ) && is_array( $raw['mobile_menu'] ) ? $raw['mobile_menu'] : array();
		$menu_title         = sanitize_text_field( $menu['title'] ?? '' );
		$out['mobile_menu'] = array(
			'enabled' => ! empty( $menu['enabled'] ),
			'title'   => '' !== $menu_title ? $menu_title : $defaults['mobile_menu']['title'],
			'source'  => in_array( ( $menu['source'] ?? '' ), array( 'wp_menu', 'auto', 'manual' ), true ) ? $menu['source'] : 'wp_menu',
			'menu_id' => max( 0, (int) ( $menu['menu_id'] ?? 0 ) ),
			'items'   => self::sanitize_menu_items( $menu['items'] ?? array() ),
		);

		return $out;
	}

	/**
	 * Product rows. Array order is the order the storefront renders them in.
	 *
	 * Row ids must be unique — the storefront uses them as React keys and the
	 * REST layer uses them to build the legacy `new_arrivals` / `hot_sellers`
	 * mirrors.
	 *
	 * @param mixed $sections Raw rows.
	 * @return array
	 */
	private static function sanitize_product_sections( $sections ) {
		if ( ! is_array( $sections ) ) {
			return array();
		}

		$clean = array();
		$seen  = array();

		foreach ( $sections as $section ) {
			if ( ! is_array( $section ) ) {
				continue;
			}

			$id = sanitize_key( $section['id'] ?? '' );

			if ( '' === $id || in_array( $id, $seen, true ) ) {
				$id = 'section_' . wp_generate_password( 6, false, false );
			}
			$seen[] = $id;

			$title  = sanitize_text_field( $section['title'] ?? '' );
			$tag    = sanitize_title( $section['tag'] ?? '' );
			$source = in_array( ( $section['source'] ?? '' ), array( 'tag', 'manual', 'category' ), true )
				? $section['source']
				: 'tag';

			$clean[] = array(
				'id'            => $id,
				'enabled'       => ! empty( $section['enabled'] ),
				'title'         => '' !== $title ? $title : 'Products',
				'view_all_link' => self::sanitize_link( $section['view_all_link'] ?? '' ),
				'layout'        => in_array( ( $section['layout'] ?? '' ), array( 'slider', 'grid' ), true ) ? $section['layout'] : 'slider',
				'source'        => $source,
				'tag'           => $tag,
				'category_id'   => max( 0, (int) ( $section['category_id'] ?? 0 ) ),
				'product_ids'   => self::sanitize_id_list( $section['product_ids'] ?? array() ),
				'limit'         => max( 1, min( 40, (int) ( $section['limit'] ?? 12 ) ) ),
			);
		}

		return $clean;
	}

	/**
	 * Mobile menu rows. Each row is a WordPress page, a product category, or a
	 * free-form link. Array order is the on-screen order.
	 *
	 * @param mixed $items Raw rows.
	 * @return array
	 */
	private static function sanitize_menu_items( $items ) {
		if ( ! is_array( $items ) ) {
			return array();
		}

		$clean = array();

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$type = in_array( ( $item['type'] ?? '' ), array( 'page', 'category', 'custom' ), true ) ? $item['type'] : 'custom';

			$row = array(
				'type'        => $type,
				'label'       => sanitize_text_field( $item['label'] ?? '' ), // blank = use the page/category name
				'page_id'     => (int) ( $item['page_id'] ?? 0 ),
				'category_id' => (int) ( $item['category_id'] ?? 0 ),
				'url'         => self::sanitize_link( $item['url'] ?? '' ),
				'enabled'     => ! isset( $item['enabled'] ) || ! empty( $item['enabled'] ),
			);

			// Drop rows that can never resolve to a destination.
			if ( 'page' === $type && $row['page_id'] <= 0 ) {
				continue;
			}
			if ( 'category' === $type && $row['category_id'] <= 0 ) {
				continue;
			}
			if ( 'custom' === $type && ( '' === $row['url'] || '' === $row['label'] ) ) {
				continue;
			}

			$clean[] = $row;
		}

		return $clean;
	}

	/**
	 * Category picker rows. Order is the array order — that is the whole point
	 * of this feature, so it is preserved verbatim.
	 *
	 * @param mixed $items Raw rows.
	 * @return array
	 */
	private static function sanitize_category_items( $items ) {
		if ( ! is_array( $items ) ) {
			return array();
		}

		$clean = array();

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$category_id = (int) ( $item['category_id'] ?? 0 );
			if ( $category_id <= 0 ) {
				continue;
			}

			$clean[] = array(
				'category_id' => $category_id,
				'label'       => sanitize_text_field( $item['label'] ?? '' ),   // blank = use the Woo category name
				'image'       => esc_url_raw( $item['image'] ?? '' ),           // blank = use the Woo category image
				'image_id'    => (int) ( $item['image_id'] ?? 0 ),
				'link'        => self::sanitize_link( $item['link'] ?? '' ),    // blank = /collections/{slug}
				'enabled'     => ! isset( $item['enabled'] ) || ! empty( $item['enabled'] ),
			);
		}

		return $clean;
	}

	/**
	 * Banner rows for a single placement.
	 *
	 * @param mixed $items Raw rows.
	 * @return array
	 */
	private static function sanitize_banner_items( $items ) {
		if ( ! is_array( $items ) ) {
			return array();
		}

		$clean = array();

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$image = esc_url_raw( $item['image'] ?? '' );
			if ( '' === $image ) {
				continue; // A banner without a desktop image is meaningless.
			}

			$clean[] = array(
				'image'           => $image,
				'image_id'        => (int) ( $item['image_id'] ?? 0 ),
				'mobile_image'    => esc_url_raw( $item['mobile_image'] ?? '' ),
				'mobile_image_id' => (int) ( $item['mobile_image_id'] ?? 0 ),
				'link'            => self::sanitize_link( $item['link'] ?? '' ),
				'alt'             => sanitize_text_field( $item['alt'] ?? '' ),
				'enabled'         => ! isset( $item['enabled'] ) || ! empty( $item['enabled'] ),
			);
		}

		return $clean;
	}

	/**
	 * Ordered, de-duplicated list of positive integer IDs.
	 *
	 * @param mixed $ids Array or comma-separated string.
	 * @return int[]
	 */
	private static function sanitize_id_list( $ids ) {
		if ( is_string( $ids ) ) {
			$ids = explode( ',', $ids );
		}

		if ( ! is_array( $ids ) ) {
			return array();
		}

		$clean = array();

		foreach ( $ids as $id ) {
			$id = (int) $id;
			if ( $id > 0 && ! in_array( $id, $clean, true ) ) {
				$clean[] = $id;
			}
		}

		return $clean;
	}

	/**
	 * Allows both absolute URLs and storefront-relative paths like
	 * "/collections/sarees".
	 *
	 * @param string $link Raw link.
	 * @return string
	 */
	private static function sanitize_link( $link ) {
		$link = trim( (string) $link );

		if ( '' === $link ) {
			return '';
		}

		if ( 0 === strpos( $link, '/' ) ) {
			return esc_url_raw( $link, array( 'http', 'https' ) );
		}

		return esc_url_raw( $link );
	}

	/**
	 * @param string $color Raw colour.
	 * @return string Hex colour or empty string.
	 */
	private static function sanitize_color( $color ) {
		$color = sanitize_hex_color( trim( (string) $color ) );

		return $color ? $color : '';
	}
}
