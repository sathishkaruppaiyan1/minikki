<?php
/**
 * Admin screen.
 *
 * The whole editor is rendered client-side from a JSON blob (see assets/admin.js)
 * and posted back as one JSON field. That keeps drag-to-reorder honest: the saved
 * order is literally the order of the rows on screen.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Minikki_Home_Admin {

	const PAGE_SLUG  = 'minikki-home';
	const SAVE_ACTION = 'minikki_home_save';
	const NONCE      = 'minikki_home_save_nonce';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_action( 'admin_post_' . self::SAVE_ACTION, array( __CLASS__, 'handle_save' ) );
	}

	public static function register_menu() {
		add_menu_page(
			__( 'Minikki Home', 'minikki-home' ),
			__( 'Minikki Home', 'minikki-home' ),
			'manage_woocommerce',
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' ),
			'dashicons-layout',
			56
		);
	}

	/**
	 * @param string $hook Current admin page hook.
	 */
	public static function enqueue( $hook ) {
		if ( 'toplevel_page_' . self::PAGE_SLUG !== $hook ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_script( 'jquery-ui-sortable' );

		wp_enqueue_style(
			'minikki-home-admin',
			MINIKKI_HOME_URL . 'assets/admin.css',
			array(),
			MINIKKI_HOME_VERSION
		);

		wp_enqueue_script(
			'minikki-home-admin',
			MINIKKI_HOME_URL . 'assets/admin.js',
			array( 'jquery', 'jquery-ui-sortable' ),
			MINIKKI_HOME_VERSION,
			true
		);

		wp_localize_script(
			'minikki-home-admin',
			'MinikkiHome',
			array(
				'config'   => Minikki_Home_Config::get(),
				'restBase' => esc_url_raw( rest_url( Minikki_Home_Rest::NAMESPACE_V1 ) ),
				'nonce'    => wp_create_nonce( 'wp_rest' ),
				'endpoint' => esc_url_raw( rest_url( Minikki_Home_Rest::NAMESPACE_V1 . '/home' ) ),
			)
		);
	}

	public static function render_page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to edit the Minikki homepage.', 'minikki-home' ) );
		}

		$tabs = array(
			'topbar'            => __( 'Top Bar', 'minikki-home' ),
			'circle_categories' => __( 'Circle Categories', 'minikki-home' ),
			'banners'           => __( 'Banners', 'minikki-home' ),
			'shop_by_category'  => __( 'Shop By Category', 'minikki-home' ),
			'products'          => __( 'New Arrivals / Hot Sellers', 'minikki-home' ),
			'reviews'           => __( 'Reviews', 'minikki-home' ),
			'mobile_menu'       => __( 'Mobile Menu', 'minikki-home' ),
		);
		?>
		<div class="wrap minikki-home-wrap">
			<h1><?php esc_html_e( 'Minikki Home Builder', 'minikki-home' ); ?></h1>

			<?php if ( isset( $_GET['minikki_saved'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
				<div class="notice notice-success is-dismissible">
					<p><?php esc_html_e( 'Homepage updated. The storefront picks up changes within a minute.', 'minikki-home' ); ?></p>
				</div>
			<?php endif; ?>

			<p class="minikki-endpoint-note">
				<?php esc_html_e( 'Storefront reads:', 'minikki-home' ); ?>
				<code><?php echo esc_html( rest_url( Minikki_Home_Rest::NAMESPACE_V1 . '/home' ) ); ?></code>
			</p>

			<h2 class="nav-tab-wrapper minikki-tabs">
				<?php foreach ( $tabs as $key => $label ) : ?>
					<a href="#<?php echo esc_attr( $key ); ?>" class="nav-tab" data-tab="<?php echo esc_attr( $key ); ?>">
						<?php echo esc_html( $label ); ?>
					</a>
				<?php endforeach; ?>
			</h2>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="minikki-home-form">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::SAVE_ACTION ); ?>" />
				<?php wp_nonce_field( self::SAVE_ACTION, self::NONCE ); ?>
				<input type="hidden" name="minikki_config_json" id="minikki-config-json" value="" />

				<?php foreach ( array_keys( $tabs ) as $key ) : ?>
					<div class="minikki-panel" data-panel="<?php echo esc_attr( $key ); ?>" hidden></div>
				<?php endforeach; ?>

				<p class="submit">
					<button type="submit" class="button button-primary button-hero">
						<?php esc_html_e( 'Save Homepage', 'minikki-home' ); ?>
					</button>
				</p>
			</form>
		</div>
		<?php
	}

	/**
	 * Persist the posted JSON blob.
	 */
	public static function handle_save() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to edit the Minikki homepage.', 'minikki-home' ) );
		}

		check_admin_referer( self::SAVE_ACTION, self::NONCE );

		$raw = isset( $_POST['minikki_config_json'] ) ? wp_unslash( $_POST['minikki_config_json'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- decoded then sanitised field-by-field in Minikki_Home_Config::sanitize().

		$decoded = json_decode( (string) $raw, true );

		if ( is_array( $decoded ) ) {
			Minikki_Home_Config::save( $decoded );
		}

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'          => self::PAGE_SLUG,
					'minikki_saved' => '1',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}
}
