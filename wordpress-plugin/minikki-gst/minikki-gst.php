<?php
/**
 * Plugin Name: Minikki GST
 * Description: Installs and repairs the Indian GST tax table for a Tamil Nadu based store — CGST 2.5% + SGST 2.5% inside TN, IGST 5% everywhere else. Replaces the older "Minikki GST Rates" and "Minikki GST Priority Fix" snippets, and adds a WooCommerce screen that shows what each state is actually charged.
 * Version:     2.0.0
 * Author:      Minikki
 * License:     GPL-2.0-or-later
 * Requires at least: 5.6
 * Requires PHP: 7.4
 *
 * WHY A REPAIR IS NEEDED
 *
 * WooCommerce applies at most ONE tax rate per priority and SUMS the winners
 * across priorities. A table that has accumulated both a blank-state IGST
 * catch-all AND per-state IGST rows on different priorities charges those
 * states twice:
 *
 *   IGST 5%  IN / (blank)  priority 1
 *   IGST 5%  IN / KA       priority 2   -> Karnataka pays 5% + 5% = 10%
 *
 * Rather than patch individual rows, this plugin rebuilds the GST rows from
 * scratch every time it runs, so the outcome does not depend on what was in
 * the table before.
 *
 * @package Minikki
 */

defined( 'ABSPATH' ) || exit;

define( 'MINIKKI_GST_VERSION', '2.0.0' );

/**
 * Bump this to force a rebuild on the next admin page load. It is stored in an
 * option, so a rebuild happens once per value, not on every request.
 */
define( 'MINIKKI_GST_RATE_VERSION', 'v2-igst5' );

define( 'MINIKKI_GST_OPTION', 'minikki_gst_rate_version' );

/** Home state. Intra-state sales here are split CGST + SGST. */
define( 'MINIKKI_GST_HOME_STATE', 'TN' );

/**
 * The canonical table.
 *
 * tax_rate_order matters: CGST and the IGST catch-all both sit on priority 1,
 * and WooCommerce breaks that tie with tax_rate_order. CGST is listed first so
 * it wins for Tamil Nadu, leaving IGST to cover every other state.
 *
 * @return array[]
 */
function minikki_gst_canonical_rates() {
	return array(
		array(
			'tax_rate_country'  => 'IN',
			'tax_rate_state'    => MINIKKI_GST_HOME_STATE,
			'tax_rate'          => '2.5000',
			'tax_rate_name'     => 'CGST',
			'tax_rate_priority' => 1,
			'tax_rate_compound' => 0,
			'tax_rate_shipping' => 1,
			'tax_rate_order'    => 0,
			'tax_rate_class'    => '', // '' is the Standard class.
		),
		array(
			'tax_rate_country'  => 'IN',
			'tax_rate_state'    => MINIKKI_GST_HOME_STATE,
			'tax_rate'          => '2.5000',
			'tax_rate_name'     => 'SGST',
			'tax_rate_priority' => 2,
			'tax_rate_compound' => 0,
			'tax_rate_shipping' => 1,
			'tax_rate_order'    => 1,
			'tax_rate_class'    => '',
		),
		array(
			'tax_rate_country'  => 'IN',
			'tax_rate_state'    => '', // Blank = every state that has no specific row.
			'tax_rate'          => '5.0000',
			'tax_rate_name'     => 'IGST',
			'tax_rate_priority' => 1,
			'tax_rate_compound' => 0,
			'tax_rate_shipping' => 1,
			'tax_rate_order'    => 9,
			'tax_rate_class'    => '',
		),
	);
}

/**
 * Deletes every existing GST row and inserts the canonical three.
 *
 * Safe to run repeatedly — that is the point. Only rows named CGST / SGST /
 * IGST in the Standard class are touched, so any other tax the store charges
 * is left alone.
 *
 * @return array{deleted:int,inserted:int}
 */
function minikki_gst_rebuild_rates() {
	global $wpdb;

	$table = $wpdb->prefix . 'woocommerce_tax_rates';

	$existing = $wpdb->get_col(
		"SELECT tax_rate_id FROM {$table}
		 WHERE tax_rate_class = ''
		   AND UPPER( tax_rate_name ) IN ( 'CGST', 'SGST', 'IGST' )"
	);

	foreach ( (array) $existing as $rate_id ) {
		WC_Tax::_delete_tax_rate( (int) $rate_id );
	}

	$inserted = 0;

	foreach ( minikki_gst_canonical_rates() as $rate ) {
		WC_Tax::_insert_tax_rate( $rate );
		$inserted++;
	}

	minikki_gst_flush_caches();

	return array(
		'deleted'  => count( (array) $existing ),
		'inserted' => $inserted,
	);
}

/**
 * Store-wide tax settings. Kept separate from the rate rebuild so the rebuild
 * button does not silently re-enable tax if the shop deliberately turned it off.
 */
function minikki_gst_apply_store_settings() {
	update_option( 'woocommerce_calc_taxes', 'yes' );
	update_option( 'woocommerce_prices_include_tax', 'no' );
	update_option( 'woocommerce_tax_based_on', 'shipping' );
	update_option( 'woocommerce_tax_display_shop', 'excl' );
	update_option( 'woocommerce_tax_display_cart', 'excl' );
	update_option( 'woocommerce_tax_total_display', 'itemized' );
}

/**
 * WooCommerce caches resolved rates in a transient and per-session.
 */
function minikki_gst_flush_caches() {
	if ( class_exists( 'WC_Cache_Helper' ) ) {
		WC_Cache_Helper::invalidate_cache_group( 'taxes' );
	}

	delete_transient( 'wc_tax_rates' );
	wp_cache_flush();
}

/**
 * Runs the rebuild once per MINIKKI_GST_RATE_VERSION.
 */
add_action( 'admin_init', 'minikki_gst_maybe_rebuild' );

function minikki_gst_maybe_rebuild() {
	if ( ! class_exists( 'WC_Tax' ) ) {
		return; // WooCommerce not active.
	}

	if ( MINIKKI_GST_RATE_VERSION === get_option( MINIKKI_GST_OPTION ) ) {
		return;
	}

	minikki_gst_apply_store_settings();
	$result = minikki_gst_rebuild_rates();

	update_option( MINIKKI_GST_OPTION, MINIKKI_GST_RATE_VERSION );

	set_transient(
		'minikki_gst_notice',
		sprintf(
			/* translators: 1: rows removed, 2: rows added */
			__( 'Minikki GST: rebuilt the tax table (%1$d old GST rows removed, %2$d installed). Tamil Nadu is charged CGST 2.5%% + SGST 2.5%%; every other state is charged IGST 5%%.', 'minikki-gst' ),
			$result['deleted'],
			$result['inserted']
		),
		60
	);
}

/**
 * Rebuild on activation too, so installing the plugin is enough.
 */
register_activation_hook(
	__FILE__,
	static function () {
		delete_option( MINIKKI_GST_OPTION );
	}
);

// ---------------------------------------------------------------------------
// Admin screen
// ---------------------------------------------------------------------------

add_action( 'admin_menu', 'minikki_gst_register_menu' );

function minikki_gst_register_menu() {
	add_submenu_page(
		'woocommerce',
		__( 'Minikki GST', 'minikki-gst' ),
		__( 'Minikki GST', 'minikki-gst' ),
		'manage_woocommerce',
		'minikki-gst',
		'minikki_gst_render_page'
	);
}

add_action( 'admin_notices', 'minikki_gst_admin_notice' );

function minikki_gst_admin_notice() {
	$message = get_transient( 'minikki_gst_notice' );

	if ( ! $message || ! current_user_can( 'manage_woocommerce' ) ) {
		return;
	}

	delete_transient( 'minikki_gst_notice' );

	printf( '<div class="notice notice-success is-dismissible"><p>%s</p></div>', esc_html( $message ) );
}

/**
 * "Re-apply" button target.
 */
add_action( 'admin_post_minikki_gst_rebuild', 'minikki_gst_handle_rebuild' );

function minikki_gst_handle_rebuild() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'You do not have permission to change tax rates.', 'minikki-gst' ) );
	}

	check_admin_referer( 'minikki_gst_rebuild' );

	if ( class_exists( 'WC_Tax' ) ) {
		minikki_gst_apply_store_settings();
		$result = minikki_gst_rebuild_rates();

		set_transient(
			'minikki_gst_notice',
			sprintf(
				/* translators: 1: rows removed, 2: rows added */
				__( 'Minikki GST: rebuilt the tax table (%1$d old GST rows removed, %2$d installed).', 'minikki-gst' ),
				$result['deleted'],
				$result['inserted']
			),
			60
		);
	}

	wp_safe_redirect( admin_url( 'admin.php?page=minikki-gst' ) );
	exit;
}

/**
 * What WooCommerce would actually charge on a given amount for one state.
 *
 * @param string $state Two-letter state code, '' for the catch-all.
 * @param float  $net   Net amount.
 * @return array{rates:array,total:float,percent:float}
 */
function minikki_gst_preview_state( $state, $net = 1000.0 ) {
	$rates = WC_Tax::find_rates(
		array(
			'country'   => 'IN',
			'state'     => $state,
			'postcode'  => '',
			'city'      => '',
			'tax_class' => '',
		)
	);

	$taxes = WC_Tax::calc_tax( $net, $rates, false );
	$total = array_sum( $taxes );

	return array(
		'rates'   => $rates,
		'total'   => $total,
		'percent' => $net > 0 ? ( $total / $net ) * 100 : 0.0,
	);
}

function minikki_gst_render_page() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'You do not have permission to view this page.', 'minikki-gst' ) );
	}

	if ( ! class_exists( 'WC_Tax' ) ) {
		echo '<div class="wrap"><h1>Minikki GST</h1><div class="notice notice-error"><p>WooCommerce is not active.</p></div></div>';
		return;
	}

	global $wpdb;

	$table = $wpdb->prefix . 'woocommerce_tax_rates';
	$rows  = $wpdb->get_results(
		"SELECT * FROM {$table}
		 WHERE tax_rate_class = ''
		 ORDER BY tax_rate_priority, tax_rate_order, tax_rate_id"
	);

	// A representative sample: the home state plus states that were previously
	// double-charged by the stale table.
	$sample_states = array(
		MINIKKI_GST_HOME_STATE => 'Tamil Nadu (home state)',
		'KA'                   => 'Karnataka',
		'MH'                   => 'Maharashtra',
		'DL'                   => 'Delhi',
		'KL'                   => 'Kerala',
		'TS'                   => 'Telangana',
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Minikki GST', 'minikki-gst' ); ?></h1>

		<p>
			<?php esc_html_e( 'Tamil Nadu is charged CGST 2.5% + SGST 2.5%. Every other state is charged IGST 5%. Both add up to 5%.', 'minikki-gst' ); ?>
		</p>

		<h2><?php esc_html_e( 'What each state is actually charged', 'minikki-gst' ); ?></h2>
		<p class="description">
			<?php esc_html_e( 'Calculated live through WooCommerce on a ₹1,000 net order. Anything other than 5.00% means the table still needs a rebuild.', 'minikki-gst' ); ?>
		</p>

		<table class="widefat striped" style="max-width:820px">
			<thead>
				<tr>
					<th><?php esc_html_e( 'State', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'Rates applied', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'Tax on ₹1,000', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'Effective', 'minikki-gst' ); ?></th>
				</tr>
			</thead>
			<tbody>
			<?php foreach ( $sample_states as $code => $label ) : ?>
				<?php
				$preview = minikki_gst_preview_state( $code );
				$names   = array();

				foreach ( $preview['rates'] as $rate ) {
					$names[] = sprintf( '%s %s%%', $rate['label'], rtrim( rtrim( $rate['rate'], '0' ), '.' ) );
				}

				$is_ok = abs( $preview['percent'] - 5.0 ) < 0.01;
				?>
				<tr>
					<td><strong><?php echo esc_html( $label ); ?></strong></td>
					<td><?php echo esc_html( $names ? implode( ' + ', $names ) : '—' ); ?></td>
					<td>₹<?php echo esc_html( number_format( $preview['total'], 2 ) ); ?></td>
					<td style="color:<?php echo $is_ok ? '#008a20' : '#d63638'; ?>;font-weight:600">
						<?php echo esc_html( number_format( $preview['percent'], 2 ) ); ?>%
						<?php echo $is_ok ? '✓' : '✗'; ?>
					</td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Standard-class tax table', 'minikki-gst' ); ?></h2>

		<table class="widefat striped" style="max-width:820px">
			<thead>
				<tr>
					<th><?php esc_html_e( 'Name', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'Country', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'State', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'Rate', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'Priority', 'minikki-gst' ); ?></th>
					<th><?php esc_html_e( 'Order', 'minikki-gst' ); ?></th>
				</tr>
			</thead>
			<tbody>
			<?php if ( ! $rows ) : ?>
				<tr><td colspan="6"><?php esc_html_e( 'No rates installed.', 'minikki-gst' ); ?></td></tr>
			<?php else : ?>
				<?php foreach ( $rows as $row ) : ?>
					<tr>
						<td><strong><?php echo esc_html( $row->tax_rate_name ); ?></strong></td>
						<td><?php echo esc_html( $row->tax_rate_country ); ?></td>
						<td><?php echo esc_html( '' === $row->tax_rate_state ? '(all others)' : $row->tax_rate_state ); ?></td>
						<td><?php echo esc_html( $row->tax_rate ); ?>%</td>
						<td><?php echo esc_html( $row->tax_rate_priority ); ?></td>
						<td><?php echo esc_html( $row->tax_rate_order ); ?></td>
					</tr>
				<?php endforeach; ?>
			<?php endif; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Rebuild', 'minikki-gst' ); ?></h2>
		<p class="description">
			<?php esc_html_e( 'Deletes every CGST / SGST / IGST row in the Standard class and reinstalls the three correct ones. Other tax classes and non-GST rates are left untouched.', 'minikki-gst' ); ?>
		</p>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="minikki_gst_rebuild" />
			<?php wp_nonce_field( 'minikki_gst_rebuild' ); ?>
			<button type="submit" class="button button-primary">
				<?php esc_html_e( 'Rebuild GST rates now', 'minikki-gst' ); ?>
			</button>
		</form>
	</div>
	<?php
}
