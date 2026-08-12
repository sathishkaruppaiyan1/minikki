<?php
/**
 * Plugin Name: Minikki GST Rates
 * Description: Installs the standard Indian GST tax table for a Tamil Nadu based store (CGST+SGST within TN, IGST elsewhere) and enables WooCommerce tax calculation.
 * Version:     1.0.0
 * Author:      Minikki
 *
 * Installs the standard Indian GST setup for a Tamil Nadu based store:
 *
 *   Tamil Nadu (intra-state)  →  CGST 2.5% + SGST 2.5%  = 5%
 *   Every other state         →  IGST 5%                = 5%
 *
 * Either paste the body of this file into your child theme's functions.php or
 * a Code Snippets plugin, or drop the whole file into wp-content/plugins/ and
 * activate it. It runs ONCE — the option flag at the bottom stops it from
 * duplicating rows on every page load. Delete that option to re-run it.
 *
 * @package Minikki
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_init', 'minikki_install_gst_rates' );

function minikki_install_gst_rates() {
	// Run once. Bump the version suffix if you change the rates below.
	if ( 'v1' === get_option( 'minikki_gst_rates_installed' ) ) {
		return;
	}

	if ( ! class_exists( 'WC_Tax' ) ) {
		return; // WooCommerce not loaded yet.
	}

	// --- Store-wide tax settings ------------------------------------------
	// Prices in the catalogue are EXCLUSIVE of tax, so GST is added at
	// checkout. Flip 'no' to 'yes' on prices_include_tax if your listed
	// prices already contain GST.
	update_option( 'woocommerce_calc_taxes', 'yes' );
	update_option( 'woocommerce_prices_include_tax', 'no' );
	update_option( 'woocommerce_tax_based_on', 'shipping' );
	update_option( 'woocommerce_tax_display_shop', 'excl' );
	update_option( 'woocommerce_tax_display_cart', 'excl' );
	update_option( 'woocommerce_tax_total_display', 'itemized' );

	// --- Rates -------------------------------------------------------------
	// WooCommerce applies at most ONE rate per priority and SUMS across
	// priorities. That is why CGST and SGST sit on priorities 1 and 2: put
	// them both on priority 1 and only one of them would ever apply.
	//
	// IGST shares priority 1 with CGST but has no state, so it only wins for
	// customers outside Tamil Nadu. tax_rate_order keeps that deterministic
	// by listing the specific TN rows first.
	$rates = array(
		array(
			'tax_rate_country'  => 'IN',
			'tax_rate_state'    => 'TN',
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
			'tax_rate_state'    => 'TN',
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
			'tax_rate_state'    => '', // Blank = every other state.
			'tax_rate'          => '5.0000',
			'tax_rate_name'     => 'IGST',
			'tax_rate_priority' => 1,
			'tax_rate_compound' => 0,
			'tax_rate_shipping' => 1,
			'tax_rate_order'    => 2,
			'tax_rate_class'    => '',
		),
	);

	foreach ( $rates as $rate ) {
		if ( ! minikki_gst_rate_exists( $rate ) ) {
			WC_Tax::_insert_tax_rate( $rate );
		}
	}

	update_option( 'minikki_gst_rates_installed', 'v1' );
}

/**
 * Avoid duplicate rows if the snippet is pasted twice or the flag is cleared.
 *
 * @param array $rate Rate definition.
 * @return bool
 */
function minikki_gst_rate_exists( $rate ) {
	global $wpdb;

	return (bool) $wpdb->get_var(
		$wpdb->prepare(
			"SELECT tax_rate_id FROM {$wpdb->prefix}woocommerce_tax_rates
			 WHERE tax_rate_country = %s
			   AND tax_rate_state = %s
			   AND tax_rate_name = %s
			   AND tax_rate_priority = %d
			 LIMIT 1",
			$rate['tax_rate_country'],
			$rate['tax_rate_state'],
			$rate['tax_rate_name'],
			$rate['tax_rate_priority']
		)
	);
}
