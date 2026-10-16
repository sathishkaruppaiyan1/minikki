<?php
/**
 * Tools → Minikki Images: progress of the WebP copies, plus a restart button.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Minikki_Images_Admin {

	const SLUG = 'minikki-images';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_post_minikki_images_restart', array( __CLASS__, 'handle_restart' ) );
	}

	public static function menu() {
		add_management_page( 'Minikki Images', 'Minikki Images', 'manage_options', self::SLUG, array( __CLASS__, 'render' ) );
	}

	public static function handle_restart() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.' );
		}
		check_admin_referer( 'minikki_images_restart' );

		Minikki_Images_Backfill::restart();

		wp_safe_redirect( admin_url( 'tools.php?page=' . self::SLUG . '&restarted=1' ) );
		exit;
	}

	public static function render() {
		$status  = Minikki_Images_Backfill::status();
		$percent = $status['total'] ? floor( $status['done'] * 100 / $status['total'] ) : 100;
		$webp    = wp_image_editor_supports( array( 'mime_type' => 'image/webp' ) );
		?>
		<div class="wrap">
			<h1>Minikki Images</h1>

			<?php if ( isset( $_GET['restarted'] ) ) : ?>
				<div class="notice notice-success"><p>Background generation restarted. It runs every 5 minutes until all images are done.</p></div>
			<?php endif; ?>

			<?php if ( ! $webp ) : ?>
				<div class="notice notice-error"><p>This server's image library cannot write WebP, so no copies can be made.</p></div>
			<?php endif; ?>

			<p>
				Every JPEG/PNG upload gets WebP copies at
				<?php echo esc_html( implode( ', ', array_map( static function ( $w ) { return $w . 'px'; }, array_keys( Minikki_Images_Generator::WIDTHS ) ) ) ); ?>
				wide, stored in <code>wp-content/uploads/<?php echo esc_html( MINIKKI_IMAGES_SUBDIR ); ?>/</code>.
				The storefront loads these instead of the originals.
			</p>

			<table class="widefat striped" style="max-width:640px">
				<tbody>
					<tr><th>Images with all copies</th><td><strong><?php echo esc_html( number_format_i18n( $status['done'] ) ); ?></strong> of <?php echo esc_html( number_format_i18n( $status['total'] ) ); ?> (<?php echo esc_html( $percent ); ?>%)</td></tr>
					<tr><th>Background sweep</th><td>
						<?php
						if ( -1 === $status['cursor'] ) {
							echo 'Finished';
						} elseif ( $status['next_run'] ) {
							echo esc_html( sprintf( 'Running — up to attachment #%d, next batch %s', $status['cursor'], human_time_diff( $status['next_run'] ) . ( $status['next_run'] > time() ? ' from now' : ' ago' ) ) );
						} else {
							echo 'Not scheduled';
						}
						?>
					</td></tr>
					<tr><th>Failed images</th><td><?php echo esc_html( count( $status['errors'] ) ); ?></td></tr>
				</tbody>
			</table>

			<?php if ( $status['errors'] ) : ?>
				<h2>Failures</h2>
				<ul>
					<?php foreach ( array_slice( $status['errors'], 0, 20, true ) as $id => $message ) : ?>
						<li><a href="<?php echo esc_url( get_edit_post_link( $id ) ); ?>">#<?php echo esc_html( $id ); ?></a> — <?php echo esc_html( $message ); ?></li>
					<?php endforeach; ?>
				</ul>
			<?php endif; ?>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:16px">
				<?php wp_nonce_field( 'minikki_images_restart' ); ?>
				<input type="hidden" name="action" value="minikki_images_restart">
				<?php submit_button( 'Check all images again', 'secondary', 'submit', false ); ?>
				<p class="description">Only missing or outdated copies are created, so this is safe to run any time.</p>
			</form>
		</div>
		<?php
	}
}
