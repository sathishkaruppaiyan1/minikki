<?php
/**
 * Plugin Name: Minikki Home Builder
 * Description: Controls the Minikki storefront homepage — announcement bar, circle categories, banners, Shop By Category, New Arrivals / Hot Sellers ordering, and photo reviews. Exposes everything on a single REST endpoint the React frontend reads.
 * Version:     1.1.0
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
define( 'MINIKKI_HOME_VERSION', '1.1.0' );
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
