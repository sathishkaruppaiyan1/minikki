<?php
/**
 * Plugin Name: Minikki Home Builder
 * Description: Controls the Minikki storefront homepage — announcement bar, circle categories, banners, Shop By Category, unlimited product sections (by tag, by category, or hand-picked, as a slider or a grid), and photo reviews. Exposes everything on a single REST endpoint the React frontend reads.
 * Version:     1.5.0
 * Author:      Minikki
 * License:     GPL-2.0-or-later
 * Text Domain: minikki-home
 * Requires at least: 5.6
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Also used as the cache-buster for admin.js / admin.css — bump on every change
// to those files or browsers will keep running the old admin screen.
define( 'MINIKKI_HOME_VERSION', '1.5.0' );
define( 'MINIKKI_HOME_FILE', __FILE__ );
define( 'MINIKKI_HOME_DIR', plugin_dir_path( __FILE__ ) );
define( 'MINIKKI_HOME_URL', plugin_dir_url( __FILE__ ) );

/** Single wp_options row holding the whole homepage configuration. */
define( 'MINIKKI_HOME_OPTION', 'minikki_home_config' );

require_once MINIKKI_HOME_DIR . 'includes/class-minikki-config.php';
require_once MINIKKI_HOME_DIR . 'includes/class-minikki-rest.php';
require_once MINIKKI_HOME_DIR . 'includes/class-minikki-admin.php';

add_action(
	'plugins_loaded',
	static function () {
		Minikki_Home_Rest::init();

		if ( is_admin() ) {
			Minikki_Home_Admin::init();
		}

		// Keep the catalog stamp current so the storefront invalidates its cached
		// homepage rows when a price changes. Registered outside is_admin(): a
		// price can be written by a CLI import, a REST call or a scheduled sale
		// transition, none of which run in the admin context.
		add_action( 'woocommerce_product_object_updated_props', array( 'Minikki_Home_Config', 'maybe_bump_for_props' ), 10, 2 );
		add_action( 'woocommerce_variation_object_updated_props', array( 'Minikki_Home_Config', 'maybe_bump_for_props' ), 10, 2 );

		// A row can reference a product by ID, so appearing and disappearing
		// counts as a change even when no price prop moved.
		add_action( 'woocommerce_new_product', array( 'Minikki_Home_Config', 'bump_catalog_stamp' ) );
		add_action( 'woocommerce_trash_product', array( 'Minikki_Home_Config', 'bump_catalog_stamp' ) );
		add_action( 'woocommerce_delete_product', array( 'Minikki_Home_Config', 'bump_catalog_stamp' ) );

		// Scheduled sale start/end changes the displayed price without a save.
		add_action( 'wc_after_products_starting_sales', array( 'Minikki_Home_Config', 'bump_catalog_stamp' ) );
		add_action( 'wc_after_products_ending_sales', array( 'Minikki_Home_Config', 'bump_catalog_stamp' ) );
	}
);

/**
 * Seed defaults on activation so the endpoint returns a usable shape immediately.
 */
register_activation_hook(
	__FILE__,
	static function () {
		if ( false === get_option( MINIKKI_HOME_OPTION, false ) ) {
			add_option( MINIKKI_HOME_OPTION, Minikki_Home_Config::defaults() );
		}
	}
);
