<?php
/**
 * Works through the existing media library in the background (WP-Cron) until
 * every image has its WebP copies. New uploads are handled by the generator
 * directly, so once the sweep finishes it stays idle until restarted.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Minikki_Images_Backfill {

	const HOOK          = 'minikki_images_backfill';
	const SCHEDULE      = 'minikki_images_five_minutes';
	const CURSOR_OPTION = 'minikki_images_cursor'; // Last attachment ID checked; -1 = finished.
	const ERRORS_OPTION = 'minikki_images_errors';  // Attachment ID => last error message.
	const TIME_BUDGET   = 20; // Seconds per cron run, well under PHP's limit.

	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'add_schedule' ) );
		add_action( self::HOOK, array( __CLASS__, 'run' ) );
	}

	public static function add_schedule( $schedules ) {
		$schedules[ self::SCHEDULE ] = array(
			'interval' => 5 * MINUTE_IN_SECONDS,
			'display'  => 'Every 5 minutes (Minikki Images)',
		);
		return $schedules;
	}

	public static function activate() {
		self::restart();
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( self::HOOK );
	}

	/** Starts a fresh sweep over the whole library. */
	public static function restart() {
		update_option( self::CURSOR_OPTION, 0, false );
		delete_option( self::ERRORS_OPTION );

		if ( ! wp_next_scheduled( self::HOOK ) ) {
			// cron_schedules isn't filtered yet during activation.
			self::init();
			wp_schedule_event( time() + 30, self::SCHEDULE, self::HOOK );
		}
	}

	public static function is_finished() {
		return -1 === (int) get_option( self::CURSOR_OPTION, -1 );
	}

	/**
	 * Processes attachments after the cursor until the time budget runs out.
	 *
	 * @param int  $time_budget Seconds; 0 = no limit (WP-CLI).
	 * @param callable|null $progress Called with ($attachment_id, $result) after each one.
	 * @return array{checked:int,written:int,errors:int,finished:bool}
	 */
	public static function run( $time_budget = self::TIME_BUDGET, $progress = null ) {
		$time_budget = is_numeric( $time_budget ) ? (int) $time_budget : self::TIME_BUDGET;
		$cursor      = (int) get_option( self::CURSOR_OPTION, -1 );
		$stats       = array( 'checked' => 0, 'written' => 0, 'errors' => 0, 'finished' => false );

		if ( -1 === $cursor ) {
			wp_clear_scheduled_hook( self::HOOK );
			$stats['finished'] = true;
			return $stats;
		}

		$started = microtime( true );
		$errors  = get_option( self::ERRORS_OPTION, array() );

		while ( true ) {
			$ids = self::next_batch( $cursor );

			if ( empty( $ids ) ) {
				update_option( self::CURSOR_OPTION, -1, false );
				wp_clear_scheduled_hook( self::HOOK );
				$stats['finished'] = true;
				break;
			}

			foreach ( $ids as $id ) {
				$result = Minikki_Images_Generator::generate( $id );

				if ( is_wp_error( $result ) ) {
					$errors[ $id ] = $result->get_error_message();
					$stats['errors']++;
				} else {
					unset( $errors[ $id ] );
					$stats['written'] += $result;
				}

				$stats['checked']++;
				$cursor = $id;

				if ( $progress ) {
					call_user_func( $progress, $id, $result );
				}

				if ( $time_budget > 0 && microtime( true ) - $started > $time_budget ) {
					break 2;
				}
			}

			update_option( self::CURSOR_OPTION, $cursor, false );
		}

		if ( ! $stats['finished'] ) {
			update_option( self::CURSOR_OPTION, $cursor, false );
		}
		update_option( self::ERRORS_OPTION, $errors, false );

		return $stats;
	}

	private static function next_batch( $after_id ) {
		global $wpdb;

		return array_map(
			'intval',
			$wpdb->get_col(
				$wpdb->prepare(
					"SELECT ID FROM {$wpdb->posts}
					 WHERE post_type = 'attachment' AND post_mime_type IN ('image/jpeg','image/png') AND ID > %d
					 ORDER BY ID ASC LIMIT 50",
					$after_id
				)
			)
		);
	}

	/** Counts for the admin screen. Checks files on disk, so only call on demand. */
	public static function status() {
		global $wpdb;

		$ids = array_map(
			'intval',
			$wpdb->get_col(
				"SELECT ID FROM {$wpdb->posts}
				 WHERE post_type = 'attachment' AND post_mime_type IN ('image/jpeg','image/png')"
			)
		);

		$done = 0;
		foreach ( $ids as $id ) {
			if ( Minikki_Images_Generator::is_complete( $id ) ) {
				$done++;
			}
		}

		return array(
			'total'    => count( $ids ),
			'done'     => $done,
			'cursor'   => (int) get_option( self::CURSOR_OPTION, -1 ),
			'next_run' => wp_next_scheduled( self::HOOK ),
			'errors'   => get_option( self::ERRORS_OPTION, array() ),
		);
	}
}
