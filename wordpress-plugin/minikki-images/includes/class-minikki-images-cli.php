<?php
/**
 * WP-CLI: wp minikki-images <generate|status>
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Minikki_Images_CLI {

	/**
	 * Creates missing WebP copies for the whole media library.
	 *
	 * ## OPTIONS
	 *
	 * [--id=<id>]
	 * : Only this attachment.
	 *
	 * [--force]
	 * : With --id, rewrite the copies even if they are up to date.
	 *
	 * ## EXAMPLES
	 *
	 *     wp minikki-images generate
	 *     wp minikki-images generate --id=15198 --force
	 */
	public function generate( $args, $assoc_args ) {
		if ( isset( $assoc_args['id'] ) ) {
			$result = Minikki_Images_Generator::generate( (int) $assoc_args['id'], isset( $assoc_args['force'] ) );
			if ( is_wp_error( $result ) ) {
				WP_CLI::error( $result->get_error_message() );
			}
			WP_CLI::success( "Wrote {$result} file(s)." );
			return;
		}

		Minikki_Images_Backfill::restart();

		$count = 0;
		$stats = Minikki_Images_Backfill::run(
			0,
			static function ( $id, $result ) use ( &$count ) {
				$count++;
				if ( is_wp_error( $result ) ) {
					WP_CLI::warning( "#{$id}: " . $result->get_error_message() );
				} elseif ( 0 === $count % 100 ) {
					WP_CLI::log( "Checked {$count} images…" );
				}
			}
		);

		WP_CLI::success( sprintf( 'Checked %d images, wrote %d files, %d failed.', $stats['checked'], $stats['written'], $stats['errors'] ) );
	}

	/**
	 * Shows how many images have all their copies.
	 */
	public function status() {
		$status = Minikki_Images_Backfill::status();
		WP_CLI::log( sprintf( 'Complete: %d / %d', $status['done'], $status['total'] ) );
		WP_CLI::log( 'Sweep: ' . ( -1 === $status['cursor'] ? 'finished' : 'at #' . $status['cursor'] ) );
		WP_CLI::log( 'Failures: ' . count( $status['errors'] ) );
	}
}
