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
				'hero'       => array(),
				'below_hero' => array(),
			),
			'new_arrivals'      => array(
				'enabled'       => true,
				'title'         => 'New Arrivals',
				'view_all_link' => '/collections/all',
				'source'        => 'tag', // tag = keep existing "new-arrivals" tag behaviour, manual = exact order below
				'tag'           => 'new-arrivals',
				'product_ids'   => array(),
			),
			'hot_sellers'       => array(
				'enabled'       => true,
				'title'         => 'Hot Sellers',
				'view_all_link' => '/collections/all',
				'source'        => 'tag',
				'tag'           => 'hot-sellers',
				'product_ids'   => array(),
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
			if ( isset( $stored[ $section ] ) && is_array( $stored[ $section ] ) ) {
				$config[ $section ] = array_merge( $section_defaults, $stored[ $section ] );
			}
		}

		return $config;
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
		$banners        = isset( $raw['banners'] ) && is_array( $raw['banners'] ) ? $raw['banners'] : array();
		$out['banners'] = array(
			'hero'       => self::sanitize_banner_items( $banners['hero'] ?? array() ),
			'below_hero' => self::sanitize_banner_items( $banners['below_hero'] ?? array() ),
		);

		// --- Product sections ------------------------------------------------
		foreach ( array( 'new_arrivals', 'hot_sellers' ) as $key ) {
			$section = isset( $raw[ $key ] ) && is_array( $raw[ $key ] ) ? $raw[ $key ] : array();

			$title = sanitize_text_field( $section['title'] ?? '' );
			$tag   = sanitize_title( $section['tag'] ?? '' );

			$out[ $key ] = array(
				'enabled'       => ! empty( $section['enabled'] ),
				'title'         => '' !== $title ? $title : $defaults[ $key ]['title'],
				'view_all_link' => self::sanitize_link( $section['view_all_link'] ?? '' ),
				'source'        => in_array( ( $section['source'] ?? '' ), array( 'tag', 'manual' ), true ) ? $section['source'] : 'tag',
				'tag'           => '' !== $tag ? $tag : $defaults[ $key ]['tag'],
				'product_ids'   => self::sanitize_id_list( $section['product_ids'] ?? array() ),
			);
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
