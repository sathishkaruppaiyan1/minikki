<?php
/**
 * Plugin Name: Minikki GST Priority Fix
 * Description: One-time repair of the WooCommerce tax table — puts every IGST row on priority 1 and removes duplicate Tamil Nadu CGST/SGST rows, so no state is charged 10% instead of 5%.
 * Version:     1.0.0
 * Author:      Minikki
 *
 * WHY THIS IS NEEDED
 *
 * WooCommerce applies at most ONE tax rate per priority and SUMS the winners
 * across priorities. The current table has:
 *
 *   IGST 5%  country IN, state (blank)  priority 1   <- catch-all
 *   IGST 5%  country IN, state KA       priority 2   <- and 8 others
 *
 * For a Karnataka customer both match: the blank-state row wins priority 1 and
 * the KA row wins priority 2, so they are charged 5% + 5% = 10%.
 *
 * Affected states: AP, JH, KA, KL, MH, MP, OR, PY, TS.
 *
 * Tamil Nadu additionally has FOUR rows (CGST and SGST each duplicated across
 * priorities 1 and 2). It happens to still total 5%, but the duplicates make
 * the outcome depend on row ordering, so they are cleaned up too.
 *
 * AFTER THIS RUNS
 *   TN            -> CGST 2.5% (p1) + SGST 2.5% (p2) = 5%
 *   every other   -> IGST 5% (p1)                    = 5%
 *
 * Install, load any admin page once, then deactivate and delete it.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_init', 'minikki_fix_gst_priorities' );

function minikki_fix_gst_priorities() {
	global $wpdb;

	if ( 'v1' === get_option( 'minikki_gst_priority_fix' ) ) {
		return;
	}
	if ( ! class_exists( 'WC_Tax' ) ) {
		return;
	}

	$table = $wpdb->prefix . 'woocommerce_tax_rates';

	// 1. Every IGST row belongs on priority 1. Once the state-specific row and
	//    the blank-state catch-all share a priority, only one of them can
	//    apply, and the more specific state row wins.
	$moved = $wpdb->query(
		"UPDATE {$table}
		 SET tax_rate_priority = 1
		 WHERE tax_rate_name = 'IGST' AND tax_rate_priority <> 1"
	);

	// 2. Tamil Nadu: keep exactly one CGST on priority 1 and one SGST on
	//    priority 2. Delete every other TN row.
	$tn_ids = $wpdb->get_col(
		"SELECT tax_rate_id FROM {$table}
		 WHERE tax_rate_country = 'IN' AND tax_rate_state = 'TN'
		 ORDER BY tax_rate_id ASC"
	);

	if ( $tn_ids ) {
		foreach ( $tn_ids as $id ) {
			WC_Tax::_delete_tax_rate( $id );
		}

		WC_Tax::_insert_tax_rate(
			array(
				'tax_rate_country'  => 'IN',
				'tax_rate_state'    => 'TN',
				'tax_rate'          => '2.5000',
				'tax_rate_name'     => 'CGST',
				'tax_rate_priority' => 1,
				'tax_rate_compound' => 0,
				'tax_rate_shipping' => 1,
				'tax_rate_order'    => 0,
				'tax_rate_class'    => '',
			)
		);
		WC_Tax::_insert_tax_rate(
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
			)
		);
	}

	// 3. WooCommerce caches resolved rates per session and in transients.
	WC_Cache_Helper::invalidate_cache_group( 'taxes' );
	delete_transient( 'wc_tax_rates' );

	update_option( 'minikki_gst_priority_fix', 'v1' );

	error_log( sprintf( 'Minikki GST fix: %d IGST rows moved to priority 1, %d TN rows rebuilt.', (int) $moved, count( $tn_ids ) ) );
}
