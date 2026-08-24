/* global jQuery, MinikkiHome, wp */
(function ($) {
	'use strict';

	var state = $.extend(true, {}, MinikkiHome.config);
	var categories = [];
	var pages = [];
	var navMenus = [];
	var productCache = {};

	// ---------------------------------------------------------------- helpers

	function get(path) {
		return path.split('.').reduce(function (acc, key) {
			return acc == null ? acc : acc[key];
		}, state);
	}

	function set(path, value) {
		var keys = path.split('.');
		var last = keys.pop();
		var target = keys.reduce(function (acc, key) {
			if (acc[key] == null) {
				acc[key] = {};
			}
			return acc[key];
		}, state);
		target[last] = value;
	}

	function esc(value) {
		return $('<div/>').text(value == null ? '' : value).html();
	}

	function attr(value) {
		return esc(value).replace(/"/g, '&quot;');
	}

	/** Opens the WP media library and hands back url + attachment id. */
	function pickMedia(title, callback) {
		var frame = wp.media({
			title: title,
			button: { text: 'Use this image' },
			multiple: false,
			library: { type: 'image' }
		});

		frame.on('select', function () {
			var attachment = frame.state().get('selection').first().toJSON();
			callback(attachment.url, attachment.id);
		});

		frame.open();
	}

	function imageField(label, urlPath, idPath) {
		var url = get(urlPath);

		return (
			'<div class="mk-image-field">' +
			'<span class="mk-image-label">' + esc(label) + '</span>' +
			'<div class="mk-image-preview">' +
			(url ? '<img src="' + attr(url) + '" alt="" />' : '<span class="mk-image-empty">No image</span>') +
			'</div>' +
			'<button type="button" class="button mk-pick-image" data-url-path="' + attr(urlPath) + '" data-id-path="' + attr(idPath) + '">' +
			(url ? 'Replace' : 'Choose image') +
			'</button>' +
			(url ? ' <button type="button" class="button-link mk-clear-image" data-url-path="' + attr(urlPath) + '" data-id-path="' + attr(idPath) + '">Remove</button>' : '') +
			'</div>'
		);
	}

	function rowHandle() {
		return '<span class="mk-handle dashicons dashicons-menu" title="Drag to reorder"></span>';
	}

	function removeButton(listPath, index) {
		return '<button type="button" class="button-link mk-remove" data-list="' + attr(listPath) + '" data-index="' + index + '" title="Remove">&times;</button>';
	}

	function textInput(path, placeholder, extraClass) {
		return '<input type="text" class="mk-input ' + (extraClass || '') + '" data-path="' + attr(path) +
			'" value="' + attr(get(path)) + '" placeholder="' + attr(placeholder || '') + '" />';
	}

	function checkbox(path, label) {
		return '<label class="mk-check"><input type="checkbox" data-path="' + attr(path) + '"' +
			(get(path) ? ' checked' : '') + ' /> ' + esc(label) + '</label>';
	}

	// ----------------------------------------------------------------- panels

	function renderTopbar() {
		var messages = get('topbar.messages') || [];

		var html =
			'<div class="mk-card">' +
			'<h3>Announcement bar</h3>' +
			'<p class="description">Shows above the header. With more than one message it scrolls continuously.</p>' +
			'<div class="mk-row-inline">' +
			checkbox('topbar.enabled', 'Show the bar') +
			'<label class="mk-field">Style' +
			'<select class="mk-input" data-path="topbar.mode">' +
			'<option value="scroll"' + (get('topbar.mode') === 'scroll' ? ' selected' : '') + '>Scrolling</option>' +
			'<option value="static"' + (get('topbar.mode') === 'static' ? ' selected' : '') + '>Static / fade</option>' +
			'</select></label>' +
			'<label class="mk-field">Loop seconds' +
			'<input type="number" min="5" max="120" class="mk-input mk-input-sm" data-path="topbar.speed" data-type="number" value="' + attr(get('topbar.speed')) + '" /></label>' +
			'<label class="mk-field">Background' +
			'<input type="text" class="mk-input mk-input-sm" data-path="topbar.background" value="' + attr(get('topbar.background')) + '" placeholder="#2b1a12" /></label>' +
			'<label class="mk-field">Text colour' +
			'<input type="text" class="mk-input mk-input-sm" data-path="topbar.color" value="' + attr(get('topbar.color')) + '" placeholder="#ffffff" /></label>' +
			'</div>' +
			'<h4>Messages</h4>' +
			'<div class="mk-list" data-sortable="topbar.messages">';

		messages.forEach(function (message, index) {
			html +=
				'<div class="mk-row" data-index="' + index + '">' +
				rowHandle() +
				textInput('topbar.messages.' + index + '.text', 'Free shipping over Rs. 999', 'mk-grow') +
				textInput('topbar.messages.' + index + '.link', 'Optional link e.g. /collections/all') +
				removeButton('topbar.messages', index) +
				'</div>';
		});

		html +=
			'</div>' +
			'<button type="button" class="button mk-add" data-list="topbar.messages" data-template="message">+ Add message</button>' +
			'</div>';

		return html;
	}

	function renderCategoryPicker(sectionPath, heading, description, withTitle) {
		var items = get(sectionPath + '.items') || [];
		var source = get(sectionPath + '.source');

		var html =
			'<div class="mk-card">' +
			'<h3>' + esc(heading) + '</h3>' +
			'<p class="description">' + esc(description) + '</p>' +
			'<div class="mk-row-inline">' +
			checkbox(sectionPath + '.enabled', 'Show this section');

		if (withTitle) {
			html += '<label class="mk-field">Heading' + textInput(sectionPath + '.title', 'Shop By Category') + '</label>';
		}

		html +=
			'<label class="mk-field">Categories' +
			'<select class="mk-input" data-path="' + attr(sectionPath + '.source') + '">' +
			'<option value="auto"' + (source === 'auto' ? ' selected' : '') + '>All WooCommerce categories (automatic)</option>' +
			'<option value="manual"' + (source === 'manual' ? ' selected' : '') + '>Choose and order manually</option>' +
			'</select></label>' +
			'</div>';

		if (source !== 'manual') {
			html += '<p class="mk-hint">Switch to <strong>Choose and order manually</strong> to pick categories and drag them into the exact order you want.</p></div>';
			return html;
		}

		html += '<div class="mk-list" data-sortable="' + attr(sectionPath + '.items') + '">';

		items.forEach(function (item, index) {
			var term = categories.filter(function (c) {
				return String(c.id) === String(item.category_id);
			})[0];

			var base = sectionPath + '.items.' + index;

			html +=
				'<div class="mk-row mk-row-block" data-index="' + index + '">' +
				'<div class="mk-row-head">' +
				rowHandle() +
				'<strong class="mk-grow">' + esc(term ? term.name : 'Category #' + item.category_id) + '</strong>' +
				checkbox(base + '.enabled', 'Visible') +
				removeButton(sectionPath + '.items', index) +
				'</div>' +
				'<div class="mk-row-body">' +
				'<label class="mk-field">Label override' + textInput(base + '.label', term ? term.name : '') + '</label>' +
				'<label class="mk-field">Link override' + textInput(base + '.link', term ? '/collections/' + term.slug : '') + '</label>' +
				imageField('Image override', base + '.image', base + '.image_id') +
				'</div>' +
				'</div>';
		});

		html += '</div>';

		html +=
			'<div class="mk-add-row">' +
			'<select class="mk-input mk-category-select">' +
			'<option value="">— Add a category —</option>' +
			categories.map(function (category) {
				return '<option value="' + attr(category.id) + '">' + esc(category.name) + ' (' + category.count + ')</option>';
			}).join('') +
			'</select>' +
			'<button type="button" class="button mk-add-category" data-list="' + attr(sectionPath + '.items') + '">Add</button>' +
			'</div>' +
			'</div>';

		return html;
	}

	function renderBannerList(placement, heading, description) {
		var listPath = 'banners.' + placement;
		var banners = get(listPath) || [];

		var html =
			'<div class="mk-card">' +
			'<h3>' + esc(heading) + '</h3>' +
			'<p class="description">' + esc(description) + '</p>' +
			'<div class="mk-list" data-sortable="' + attr(listPath) + '">';

		banners.forEach(function (banner, index) {
			var base = listPath + '.' + index;

			html +=
				'<div class="mk-row mk-row-block" data-index="' + index + '">' +
				'<div class="mk-row-head">' +
				rowHandle() +
				'<strong class="mk-grow">' + esc(banner.alt || 'Banner ' + (index + 1)) + '</strong>' +
				checkbox(base + '.enabled', 'Visible') +
				removeButton(listPath, index) +
				'</div>' +
				'<div class="mk-row-body">' +
				imageField('Desktop image', base + '.image', base + '.image_id') +
				imageField('Mobile image (optional)', base + '.mobile_image', base + '.mobile_image_id') +
				'<label class="mk-field">Link' + textInput(base + '.link', '/collections/all') + '</label>' +
				'<label class="mk-field">Alt text' + textInput(base + '.alt', 'Diwali collection') + '</label>' +
				'</div>' +
				'</div>';
		});

		html +=
			'</div>' +
			'<button type="button" class="button mk-add" data-list="' + attr(listPath) + '" data-template="banner">+ Add banner</button>' +
			'</div>';

		return html;
	}

	function categorySelect(path, selectedId) {
		var options = '<option value="0">— choose a category —</option>';

		categories.forEach(function (category) {
			options += '<option value="' + attr(category.id) + '"' +
				(String(category.id) === String(selectedId) ? ' selected' : '') + '>' +
				esc(category.name) + (category.count ? ' (' + category.count + ')' : '') +
				'</option>';
		});

		return '<select class="mk-input" data-type="number" data-path="' + attr(path) + '">' + options + '</select>';
	}

	/**
	 * One product row. Rows are added, removed and reordered freely; the two
	 * built-in ids (new_arrivals / hot_sellers) are editable like any other but
	 * are labelled so they stay recognisable.
	 */
	function renderProductSection(section, index, total) {
		var base = 'product_sections.' + index;
		var source = section.source || 'tag';
		var layout = section.layout || 'slider';
		var ids = section.product_ids || [];
		var builtIn = section.id === 'new_arrivals' || section.id === 'hot_sellers';

		var html =
			'<div class="mk-card mk-section-card">' +
			'<div class="mk-section-head">' +
			'<h3>' + esc(section.title || 'Untitled section') +
			(builtIn ? ' <span class="mk-badge">built-in</span>' : '') +
			'</h3>' +
			'<div class="mk-section-tools">' +
			'<button type="button" class="button mk-move-section" data-index="' + index + '" data-dir="-1"' +
			(index === 0 ? ' disabled' : '') + '>↑</button>' +
			'<button type="button" class="button mk-move-section" data-index="' + index + '" data-dir="1"' +
			(index === total - 1 ? ' disabled' : '') + '>↓</button>' +
			'<button type="button" class="button-link-delete mk-remove-section" data-index="' + index + '">Remove</button>' +
			'</div>' +
			'</div>' +

			'<div class="mk-row-inline">' +
			checkbox(base + '.enabled', 'Show this section') +
			'<label class="mk-field">Heading' + textInput(base + '.title', 'Section heading') + '</label>' +
			'<label class="mk-field">"View all" link' + textInput(base + '.view_all_link', '/collections/all') + '</label>' +
			'<label class="mk-field">Layout' +
			'<select class="mk-input" data-path="' + attr(base + '.layout') + '">' +
			'<option value="slider"' + (layout === 'slider' ? ' selected' : '') + '>Slider (auto-scrolling)</option>' +
			'<option value="grid"' + (layout === 'grid' ? ' selected' : '') + '>Grid</option>' +
			'</select></label>' +
			'<label class="mk-field">Products' +
			'<select class="mk-input" data-path="' + attr(base + '.source') + '">' +
			'<option value="tag"' + (source === 'tag' ? ' selected' : '') + '>By product tag (automatic)</option>' +
			'<option value="category"' + (source === 'category' ? ' selected' : '') + '>By category (automatic)</option>' +
			'<option value="manual"' + (source === 'manual' ? ' selected' : '') + '>Choose and order manually</option>' +
			'</select></label>';

		if (source === 'tag') {
			html += '<label class="mk-field">Tag slug' + textInput(base + '.tag', 'new-arrivals') + '</label>';
		}

		if (source === 'category') {
			html += '<label class="mk-field">Category' + categorySelect(base + '.category_id', section.category_id) + '</label>';
		}

		if (source !== 'manual') {
			html += '<label class="mk-field mk-field-narrow">How many' +
				'<input type="number" min="1" max="40" class="mk-input" data-type="number" data-path="' +
				attr(base + '.limit') + '" value="' + attr(section.limit || 12) + '" /></label>';
		}

		html += '</div>';

		if (source === 'tag') {
			html += '<p class="mk-hint">Every published product carrying this tag.</p></div>';
			return html;
		}

		if (source === 'category') {
			html += '<p class="mk-hint">Every published product in this category. Switch to <strong>Choose and order manually</strong> to control the exact order.</p></div>';
			return html;
		}

		html += '<div class="mk-list mk-product-list" data-sortable="' + attr(base + '.product_ids') + '">';

		ids.forEach(function (id, rowIndex) {
			var product = productCache[id];

			html +=
				'<div class="mk-row mk-product-row" data-index="' + rowIndex + '">' +
				rowHandle() +
				'<span class="mk-product-thumb">' +
				(product && product.image ? '<img src="' + attr(product.image) + '" alt="" />' : '') +
				'</span>' +
				'<span class="mk-grow">' + esc(product ? product.name : 'Product #' + id) + '</span>' +
				'<span class="mk-product-meta">' + esc(product ? product.price : '') + '</span>' +
				removeButton(base + '.product_ids', rowIndex) +
				'</div>';
		});

		html += '</div>';

		html +=
			'<div class="mk-add-row">' +
			'<input type="search" class="mk-input mk-product-search" placeholder="Search products by name or SKU…" data-target="' + attr(base + '.product_ids') + '" />' +
			'<div class="mk-search-results"></div>' +
			'</div>' +
			'</div>';

		return html;
	}

	function renderProductSections() {
		var sections = get('product_sections') || [];

		var html =
			'<div class="mk-card mk-intro">' +
			'<h3>Product sections</h3>' +
			'<p class="mk-hint">Rows of products on the homepage, shown top to bottom in this order. ' +
			'Add as many as you like — each one can pull products from a tag, from a category, or from a list you pick by hand.</p>' +
			'<button type="button" class="button button-secondary mk-add-section">+ Add product section</button>' +
			'</div>';

		if (!sections.length) {
			return html + '<div class="mk-card"><p class="mk-hint">No product sections yet.</p></div>';
		}

		return html + sections.map(function (section, index) {
			return renderProductSection(section, index, sections.length);
		}).join('');
	}

	function renderReviews() {
		var items = get('reviews.items') || [];

		var html =
			'<div class="mk-card">' +
			'<h3>Customer reviews</h3>' +
			'<p class="description">Reviews shown in the “Minikki x You” slider. Add a photo to each one.</p>' +
			'<div class="mk-row-inline">' +
			checkbox('reviews.enabled', 'Show this section') +
			'<label class="mk-field">Heading' + textInput('reviews.title', 'MINIKKI x YOU') + '</label>' +
			'<label class="mk-field">Sub-heading' + textInput('reviews.subtitle', 'Happy Minikki Family') + '</label>' +
			'</div>' +
			'<div class="mk-list" data-sortable="reviews.items">';

		items.forEach(function (item, index) {
			var base = 'reviews.items.' + index;
			var rating = parseInt(item.rating, 10) || 5;
			var options = '';

			for (var star = 5; star >= 1; star--) {
				options += '<option value="' + star + '"' + (rating === star ? ' selected' : '') + '>' + star + ' star' + (star > 1 ? 's' : '') + '</option>';
			}

			html +=
				'<div class="mk-row mk-row-block" data-index="' + index + '">' +
				'<div class="mk-row-head">' +
				rowHandle() +
				'<strong class="mk-grow">' + esc(item.name || 'Review ' + (index + 1)) + '</strong>' +
				checkbox(base + '.enabled', 'Visible') +
				removeButton('reviews.items', index) +
				'</div>' +
				'<div class="mk-row-body">' +
				imageField('Customer photo', base + '.image', base + '.image_id') +
				'<label class="mk-field">Name' + textInput(base + '.name', 'Priya Sharma') + '</label>' +
				'<label class="mk-field">Rating' +
				'<select class="mk-input" data-path="' + attr(base + '.rating') + '" data-type="number">' + options + '</select></label>' +
				'<label class="mk-field">Link (optional)' + textInput(base + '.link', '/product/123') + '</label>' +
				'<label class="mk-field mk-field-wide">Review' +
				'<textarea class="mk-input" rows="3" data-path="' + attr(base + '.text') + '" placeholder="The fabric quality is amazing…">' + esc(item.text) + '</textarea>' +
				'</label>' +
				'</div>' +
				'</div>';
		});

		html +=
			'</div>' +
			'<button type="button" class="button mk-add" data-list="reviews.items" data-template="review">+ Add review</button>' +
			'</div>';

		return html;
	}

	function renderMobileMenu() {
		var items = get('mobile_menu.items') || [];
		var source = get('mobile_menu.source');

		var html =
			'<div class="mk-card">' +
			'<h3>Mobile menu</h3>' +
			'<p class="description">The slide-out menu behind the &#9776; button on phones.</p>' +
			'<div class="mk-row-inline">' +
			checkbox('mobile_menu.enabled', 'Show the menu button') +
			'<label class="mk-field">Panel heading' + textInput('mobile_menu.title', 'Menu') + '</label>' +
			'<label class="mk-field">Items' +
			'<select class="mk-input" data-path="mobile_menu.source">' +
			'<option value="wp_menu"' + (source === 'wp_menu' ? ' selected' : '') + '>Use a WordPress menu (Appearance &rarr; Menus)</option>' +
			'<option value="auto"' + (source === 'auto' ? ' selected' : '') + '>Every WordPress page (automatic)</option>' +
			'<option value="manual"' + (source === 'manual' ? ' selected' : '') + '>Choose and order manually</option>' +
			'</select></label>';

		if (source === 'wp_menu') {
			html +=
				'<label class="mk-field">Which menu' +
				'<select class="mk-input" data-path="mobile_menu.menu_id" data-type="number">' +
				'<option value="0">Auto — the menu your theme uses</option>' +
				navMenus.map(function (menu) {
					return '<option value="' + attr(menu.id) + '"' +
						(parseInt(get('mobile_menu.menu_id'), 10) === menu.id ? ' selected' : '') + '>' +
						esc(menu.name) + ' (' + menu.count + ' items' + (menu.assigned ? ', in use' : '') + ')</option>';
				}).join('') +
				'</select></label>';
		}

		html += '</div>';

		if (source === 'wp_menu') {
			if (!navMenus.length) {
				html += '<p class="mk-hint">This site has no menus yet. Create one under <strong>Appearance &rarr; Menus</strong>, then it will appear here and on the storefront.</p></div>';
			} else {
				html += '<p class="mk-hint">Edit the menu itself under <strong>Appearance &rarr; Menus</strong> — items, labels and order there are what the app shows. Category, page and product links are rewritten automatically to storefront URLs.</p>' +
					'<div class="mk-menu-preview" data-loading="1">Loading menu preview…</div></div>';
			}
			return html;
		}

		if (source !== 'manual') {
			html += '<p class="mk-hint">Right now every published page is listed, in alphabetical order. Switch to <strong>Use a WordPress menu</strong> to show the menu your theme already has.</p></div>';
			return html;
		}

		html += '<div class="mk-list" data-sortable="mobile_menu.items">';

		items.forEach(function (item, index) {
			var base = 'mobile_menu.items.' + index;
			var target = '';

			if (item.type === 'page') {
				var page = pages.filter(function (p) { return String(p.id) === String(item.page_id); })[0];
				target = page ? 'Page: ' + page.title : 'Page #' + item.page_id + ' (missing)';
			} else if (item.type === 'category') {
				var cat = categories.filter(function (c) { return String(c.id) === String(item.category_id); })[0];
				target = cat ? 'Category: ' + cat.name : 'Category #' + item.category_id + ' (missing)';
			} else {
				target = 'Link';
			}

			html +=
				'<div class="mk-row mk-row-block" data-index="' + index + '">' +
				'<div class="mk-row-head">' +
				rowHandle() +
				'<strong class="mk-grow">' + esc(item.label || target) + '</strong>' +
				'<span class="mk-product-meta">' + esc(target) + '</span>' +
				checkbox(base + '.enabled', 'Visible') +
				removeButton('mobile_menu.items', index) +
				'</div>' +
				'<div class="mk-row-body">' +
				'<label class="mk-field">Label' + textInput(base + '.label', 'Leave blank to use the page name') + '</label>' +
				(item.type === 'custom'
					? '<label class="mk-field">Link' + textInput(base + '.url', '/collections/all') + '</label>'
					: '') +
				'</div>' +
				'</div>';
		});

		html += '</div>';

		html +=
			'<div class="mk-add-row mk-menu-add">' +
			'<select class="mk-input mk-menu-select">' +
			'<option value="">— Add an item —</option>' +
			'<optgroup label="Pages">' +
			pages.map(function (page) {
				return '<option value="page:' + attr(page.id) + '">' + esc(page.title) + '</option>';
			}).join('') +
			'</optgroup>' +
			'<optgroup label="Categories">' +
			categories.map(function (category) {
				return '<option value="category:' + attr(category.id) + '">' + esc(category.name) + '</option>';
			}).join('') +
			'</optgroup>' +
			'<optgroup label="Other"><option value="custom:0">Custom link…</option></optgroup>' +
			'</select>' +
			'<button type="button" class="button mk-add-menu-item">Add</button>' +
			'</div>' +
			'</div>';

		return html;
	}

	// ----------------------------------------------------------------- render

	function render() {
		$('[data-panel="topbar"]').html(renderTopbar());

		$('[data-panel="circle_categories"]').html(
			renderCategoryPicker(
				'circle_categories',
				'Circle category strip',
				'The round category icons at the very top of the homepage.',
				false
			)
		);

		$('[data-panel="banners"]').html(
			renderBannerList('hero', 'Hero banners', 'The main slider directly under the header. Multiple banners auto-rotate.') +
			renderBannerList('below_hero', 'Banners below hero', 'An extra banner strip between the hero and Shop By Category.')
		);

		$('[data-panel="shop_by_category"]').html(
			renderCategoryPicker(
				'shop_by_category',
				'Shop By Category grid',
				'The larger category cards further down the homepage. Order here is the order shown.',
				true
			)
		);

		$('[data-panel="products"]').html(renderProductSections());

		$('[data-panel="reviews"]').html(renderReviews());

		$('[data-panel="mobile_menu"]').html(renderMobileMenu());

		initSortables();
		refreshMenuPreview();
	}

	/**
	 * Shows what the storefront will actually receive, resolved links and all.
	 * Reads the live endpoint, so it reflects the last *saved* state.
	 */
	function refreshMenuPreview() {
		var $preview = $('.mk-menu-preview');

		if (!$preview.length) {
			return;
		}

		$.ajax({ url: MinikkiHome.endpoint, cache: false })
			.then(function (response) {
				var menu = response && response.mobile_menu;
				var items = (menu && menu.items) || [];

				if (!items.length) {
					$preview.html('<div class="mk-search-empty">No items resolved yet. Save this page after choosing a menu.</div>');
					return;
				}

				$preview.html(
					'<div class="mk-preview-head">Storefront will show (' + items.length + '):</div>' +
					items.map(function (item) {
						return '<div class="mk-preview-item' + (item.parent ? ' mk-preview-child' : '') + '">' +
							'<span class="mk-grow">' + esc(item.label) + '</span>' +
							'<code>' + esc(item.link) + '</code>' +
							'</div>';
					}).join('')
				);
			})
			.fail(function () {
				$preview.html('<div class="mk-search-empty">Could not load the preview.</div>');
			});
	}

	function initSortables() {
		$('.mk-list').each(function () {
			var $list = $(this);
			var path = $list.data('sortable');

			if ($list.data('ui-sortable')) {
				$list.sortable('destroy');
			}

			$list.sortable({
				handle: '.mk-handle',
				axis: 'y',
				placeholder: 'mk-placeholder',
				forcePlaceholderSize: true,
				update: function () {
					var order = $list.children('.mk-row').map(function () {
						return parseInt($(this).data('index'), 10);
					}).get();

					var current = get(path) || [];
					set(path, order.map(function (index) {
						return current[index];
					}));

					render();
				}
			});
		});
	}

	function showTab(tab) {
		$('.minikki-panel').attr('hidden', true);
		$('[data-panel="' + tab + '"]').removeAttr('hidden');
		$('.minikki-tabs .nav-tab').removeClass('nav-tab-active');
		$('.minikki-tabs .nav-tab[data-tab="' + tab + '"]').addClass('nav-tab-active');
	}

	// ------------------------------------------------------------------ data

	function loadCategories() {
		return $.ajax({
			url: MinikkiHome.restBase + '/admin/categories',
			headers: { 'X-WP-Nonce': MinikkiHome.nonce }
		}).then(function (response) {
			categories = (response && response.categories) || [];
		});
	}

	function loadMenus() {
		return $.ajax({
			url: MinikkiHome.restBase + '/admin/menus',
			headers: { 'X-WP-Nonce': MinikkiHome.nonce }
		}).then(function (response) {
			navMenus = (response && response.menus) || [];
		});
	}

	function loadPages() {
		return $.ajax({
			url: MinikkiHome.restBase + '/admin/pages',
			headers: { 'X-WP-Nonce': MinikkiHome.nonce }
		}).then(function (response) {
			pages = (response && response.pages) || [];
		});
	}

	/** Pull names/thumbs for products already saved in either section. */
	function loadSavedProducts() {
		var ids = [];

		(get('product_sections') || []).forEach(function (section) {
			ids = ids.concat(section.product_ids || []);
		});

		if (!ids.length) {
			return $.Deferred().resolve().promise();
		}

		return $.ajax({
			url: MinikkiHome.restBase + '/admin/products',
			data: { ids: ids.join(',') },
			headers: { 'X-WP-Nonce': MinikkiHome.nonce }
		}).then(function (response) {
			((response && response.products) || []).forEach(function (product) {
				productCache[product.id] = product;
			});
		});
	}

	// ---------------------------------------------------------------- events

	$(document)
		.on('click', '.minikki-tabs .nav-tab', function (event) {
			event.preventDefault();
			showTab($(this).data('tab'));
		})

		// Live-bind plain fields without re-rendering, so typing keeps focus.
		.on('input change', '.mk-input', function () {
			var $field = $(this);
			var path = $field.data('path');

			if (!path) {
				return;
			}

			var value = $field.is(':checkbox') ? $field.is(':checked') : $field.val();

			if ($field.data('type') === 'number') {
				value = parseInt(value, 10) || 0;
			}

			set(path, value);

			// Switching the source changes which controls are relevant. The
			// heading is re-rendered too so the card title tracks what you type.
			if (/\.(source)$/.test(path)) {
				render();
			} else if (/^product_sections\.\d+\.title$/.test(path)) {
				$field.closest('.mk-section-card').find('.mk-section-head h3').contents().first()
					.replaceWith(document.createTextNode($field.val() || 'Untitled section'));
			}
		})

		.on('change', '.mk-check input[type="checkbox"]', function () {
			var path = $(this).data('path');
			if (path) {
				set(path, $(this).is(':checked'));
			}
		})

		.on('click', '.mk-pick-image', function () {
			var $button = $(this);

			pickMedia('Select image', function (url, id) {
				set($button.data('url-path'), url);
				set($button.data('id-path'), id);
				render();
			});
		})

		.on('click', '.mk-clear-image', function () {
			set($(this).data('url-path'), '');
			set($(this).data('id-path'), 0);
			render();
		})

		.on('click', '.mk-remove', function () {
			var list = get($(this).data('list')) || [];
			list.splice(parseInt($(this).data('index'), 10), 1);
			render();
		})

		.on('click', '.mk-add', function () {
			var listPath = $(this).data('list');
			var template = $(this).data('template');
			var list = get(listPath) || [];

			if (template === 'message') {
				list.push({ text: '', link: '' });
			} else if (template === 'banner') {
				list.push({ image: '', image_id: 0, mobile_image: '', mobile_image_id: 0, link: '', alt: '', enabled: true });
			} else if (template === 'review') {
				list.push({ name: '', text: '', rating: 5, image: '', image_id: 0, link: '', enabled: true });
			}

			set(listPath, list);
			render();
		})

		.on('click', '.mk-add-category', function () {
			var $select = $(this).siblings('.mk-category-select');
			var categoryId = parseInt($select.val(), 10);

			if (!categoryId) {
				return;
			}

			var listPath = $(this).data('list');
			var list = get(listPath) || [];

			var exists = list.some(function (item) {
				return parseInt(item.category_id, 10) === categoryId;
			});

			if (exists) {
				window.alert('That category is already in the list.');
				return;
			}

			list.push({ category_id: categoryId, label: '', image: '', image_id: 0, link: '', enabled: true });
			set(listPath, list);
			render();
		})

		.on('click', '.mk-add-menu-item', function () {
			var value = $(this).siblings('.mk-menu-select').val();

			if (!value) {
				return;
			}

			var parts = value.split(':');
			var type = parts[0];
			var id = parseInt(parts[1], 10) || 0;
			var list = get('mobile_menu.items') || [];

			list.push({
				type: type,
				label: '',
				page_id: type === 'page' ? id : 0,
				category_id: type === 'category' ? id : 0,
				url: '',
				enabled: true
			});

			set('mobile_menu.items', list);
			render();
		})

		.on('click', '.mk-add-section', function () {
			var list = get('product_sections') || [];

			list.push({
				id: 'section_' + Math.random().toString(36).slice(2, 8),
				enabled: true,
				title: 'New section',
				view_all_link: '/collections/all',
				layout: 'slider',
				source: 'tag',
				tag: '',
				category_id: 0,
				product_ids: [],
				limit: 12
			});

			set('product_sections', list);
			render();
		})

		.on('click', '.mk-remove-section', function () {
			var index = parseInt($(this).data('index'), 10);
			var list = get('product_sections') || [];
			var section = list[index];

			if (!section) {
				return;
			}

			if (!window.confirm('Remove "' + (section.title || 'this section') + '" from the homepage?')) {
				return;
			}

			list.splice(index, 1);
			set('product_sections', list);
			render();
		})

		.on('click', '.mk-move-section', function () {
			var index = parseInt($(this).data('index'), 10);
			var target = index + parseInt($(this).data('dir'), 10);
			var list = get('product_sections') || [];

			if (target < 0 || target >= list.length) {
				return;
			}

			var moved = list.splice(index, 1)[0];
			list.splice(target, 0, moved);

			set('product_sections', list);
			render();
		})

		.on('input', '.mk-product-search', function () {
			var $input = $(this);
			var term = $.trim($input.val());
			var $results = $input.siblings('.mk-search-results');

			clearTimeout($input.data('timer'));

			if (term.length < 2) {
				$results.empty();
				return;
			}

			$input.data('timer', setTimeout(function () {
				$.ajax({
					url: MinikkiHome.restBase + '/admin/products',
					data: { q: term },
					headers: { 'X-WP-Nonce': MinikkiHome.nonce }
				}).then(function (response) {
					var products = (response && response.products) || [];

					if (!products.length) {
						$results.html('<div class="mk-search-empty">No products found.</div>');
						return;
					}

					$results.html(products.map(function (product) {
						productCache[product.id] = product;

						return '<button type="button" class="mk-search-item" data-id="' + product.id + '">' +
							(product.image ? '<img src="' + attr(product.image) + '" alt="" />' : '<span class="mk-search-noimg"></span>') +
							'<span class="mk-grow">' + esc(product.name) + '</span>' +
							'<span class="mk-product-meta">' + esc(product.price) + '</span>' +
							'</button>';
					}).join(''));
				});
			}, 250));
		})

		.on('click', '.mk-search-item', function () {
			var id = parseInt($(this).data('id'), 10);
			var listPath = $(this).closest('.mk-add-row').find('.mk-product-search').data('target');
			var list = get(listPath) || [];

			if (list.indexOf(id) === -1) {
				list.push(id);
				set(listPath, list);
			}

			render();
		});

	$('#minikki-home-form').on('submit', function () {
		$('#minikki-config-json').val(JSON.stringify(state));
	});

	// ------------------------------------------------------------------ boot

	$(function () {
		$.when(loadCategories(), loadPages(), loadMenus(), loadSavedProducts())
			.always(function () {
				render();
				showTab('topbar');
			});
	});
})(jQuery);
