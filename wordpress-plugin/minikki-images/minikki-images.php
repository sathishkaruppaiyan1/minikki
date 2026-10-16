<?php
/**
 * Plugin Name: Minikki Images
 * Description: Pre-generates small WebP copies of every uploaded image (150, 400, 800 and 1600px wide) for the React storefront. The storefront requests these instead of multi-megabyte originals and falls back to the original when a copy is missing.
 * Version:     1.0.0
 * Author:      Minikki
 * License:     GPL-2.0-or-later
 * Text Domain: minikki-images
 * Requires at least: 5.6
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MINIKKI_IMAGES_VERSION', '1.0.0' );
define( 'MINIKKI_IMAGES_DIR', plugin_dir_path( __FILE__ ) );

/**
 * Folder under wp-content/uploads that mirrors the uploads tree:
 *   uploads/2026/10/photo.jpeg -> uploads/minikki-img/2026/10/photo.jpeg.800.webp
 *
 * The frontend builds these URLs itself (src/lib/imageOptimizer.ts) — keep the
 * folder name, the widths and the naming scheme in sync with it.
 */
define( 'MINIKKI_IMAGES_SUBDIR', 'minikki-img' );

require_once MINIKKI_IMAGES_DIR . 'includes/class-minikki-images-generator.php';
require_once MINIKKI_IMAGES_DIR . 'includes/class-minikki-images-backfill.php';
require_once MINIKKI_IMAGES_DIR . 'includes/class-minikki-images-admin.php';

add_action(
	'plugins_loaded',
	static function () {
		Minikki_Images_Generator::init();
		Minikki_Images_Backfill::init();

		if ( is_admin() ) {
			Minikki_Images_Admin::init();
		}

		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			require_once MINIKKI_IMAGES_DIR . 'includes/class-minikki-images-cli.php';
			WP_CLI::add_command( 'minikki-images', 'Minikki_Images_CLI' );
		}
	}
);

register_activation_hook( __FILE__, array( 'Minikki_Images_Backfill', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Minikki_Images_Backfill', 'deactivate' ) );
