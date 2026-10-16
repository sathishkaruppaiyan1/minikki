<?php
/**
 * Creates, checks and deletes the WebP copies of one attachment.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Minikki_Images_Generator {

	/** Width (px) => WebP quality. Mirrors VARIANT_WIDTHS in src/lib/imageOptimizer.ts. */
	const WIDTHS = array(
		150  => 72,
		400  => 78,
		800  => 80,
		1600 => 80,
	);

	const MIME_TYPES = array( 'image/jpeg', 'image/png' );

	public static function init() {
		// Fires after every upload, regenerate-thumbnails run and image edit,
		// with the attachment's final file already on disk.
		add_filter( 'wp_update_attachment_metadata', array( __CLASS__, 'on_metadata_update' ), 20, 2 );
		add_action( 'delete_attachment', array( __CLASS__, 'delete_variants' ) );
	}

	public static function on_metadata_update( $metadata, $attachment_id ) {
		self::generate( (int) $attachment_id );
		return $metadata;
	}

	/** Absolute path of the variants folder root, without trailing slash. */
	public static function base_dir() {
		$uploads = wp_get_upload_dir();
		return trailingslashit( $uploads['basedir'] ) . MINIKKI_IMAGES_SUBDIR;
	}

	/** Source file path relative to the uploads folder, or null if it isn't a supported image. */
	private static function relative_source( $attachment_id ) {
		if ( ! in_array( get_post_mime_type( $attachment_id ), self::MIME_TYPES, true ) ) {
			return null;
		}

		$relative = get_post_meta( $attachment_id, '_wp_attached_file', true );
		if ( ! $relative || 0 === strpos( $relative, '/' ) || false !== strpos( $relative, '..' ) ) {
			return null;
		}

		return $relative;
	}

	public static function variant_path( $relative, $width ) {
		return self::base_dir() . '/' . $relative . '.' . $width . '.webp';
	}

	/** True when every width exists and is at least as new as the source. */
	public static function is_complete( $attachment_id ) {
		$relative = self::relative_source( $attachment_id );
		if ( null === $relative ) {
			return true; // Nothing to do for this attachment.
		}

		$source = get_attached_file( $attachment_id );
		if ( ! $source || ! file_exists( $source ) ) {
			return true;
		}

		$source_mtime = filemtime( $source );
		foreach ( array_keys( self::WIDTHS ) as $width ) {
			$path = self::variant_path( $relative, $width );
			if ( ! file_exists( $path ) || filemtime( $path ) < $source_mtime ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Writes any missing or stale variants.
	 *
	 * @return int|WP_Error Number of files written.
	 */
	public static function generate( $attachment_id, $force = false ) {
		$relative = self::relative_source( $attachment_id );
		if ( null === $relative ) {
			return 0;
		}

		$source = get_attached_file( $attachment_id );
		if ( ! $source || ! file_exists( $source ) ) {
			return 0;
		}

		if ( ! $force && self::is_complete( $attachment_id ) ) {
			return 0;
		}

		if ( ! wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) ) ) {
			return new WP_Error( 'minikki_images_no_webp', 'The server image library cannot write WebP.' );
		}

		$dir = dirname( self::variant_path( $relative, 0 ) );
		if ( ! wp_mkdir_p( $dir ) ) {
			return new WP_Error( 'minikki_images_mkdir', 'Could not create ' . $dir );
		}

		$source_mtime = filemtime( $source );
		$written      = 0;

		// Largest first so each step resizes the already-shrunk image instead
		// of decoding the original again.
		$widths = self::WIDTHS;
		krsort( $widths );

		$editor = wp_get_image_editor( $source );
		if ( is_wp_error( $editor ) ) {
			return $editor;
		}
		if ( method_exists( $editor, 'maybe_exif_rotate' ) ) {
			$editor->maybe_exif_rotate();
		}

		foreach ( $widths as $width => $quality ) {
			$path = self::variant_path( $relative, $width );
			if ( ! $force && file_exists( $path ) && filemtime( $path ) >= $source_mtime ) {
				continue;
			}

			$size = $editor->get_size();
			if ( $size['width'] > $width ) {
				$resized = $editor->resize( $width, null, false );
				if ( is_wp_error( $resized ) ) {
					return $resized;
				}
			}

			$editor->set_quality( $quality );
			$saved = $editor->save( $path, 'image/webp' );
			if ( is_wp_error( $saved ) ) {
				return $saved;
			}

			// The editor may append its own suffix; we need the exact name.
			if ( isset( $saved['path'] ) && $saved['path'] !== $path ) {
				rename( $saved['path'], $path );
			}

			$written++;
		}

		return $written;
	}

	public static function delete_variants( $attachment_id ) {
		$relative = self::relative_source( $attachment_id );
		if ( null === $relative ) {
			return;
		}

		foreach ( array_keys( self::WIDTHS ) as $width ) {
			$path = self::variant_path( $relative, $width );
			if ( file_exists( $path ) ) {
				wp_delete_file( $path );
			}
		}
	}
}
