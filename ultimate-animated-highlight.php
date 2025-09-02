<?php
/*
	Plugin Name: Ultimate Animated Highlight
	Description: Line-by-line animated highlights (marker, line, swoosh) with exact SVG curves and per-line animation.
	Version: 0.1.1
	Author: Joe Thomas
	License: GPLv2 or later
	Text Domain: ultimate-animated-highlight

	GitHub Plugin URI: joethomas/ultimate-animated-highlight
	Primary Branch: main
*/
if ( ! defined('ABSPATH') ) exit;

define('UAH_DIR', plugin_dir_path(__FILE__));
define('UAH_URL', plugin_dir_url(__FILE__));

add_action('wp_enqueue_scripts', function () {
	wp_register_style('uah-style', UAH_URL.'assets/uah.css', [], '0.1.0');
	wp_register_script('uah-script', UAH_URL.'assets/uah.js', [], '0.1.0', true);

	// Provide asset locations + baseline anchors to JS
	wp_localize_script('uah-script', 'UAH_ASSETS', [
		'base'    => UAH_URL.'assets/',
		'svgs'    => [
			'marker' => 'highlight-marker.svg',
			'line'   => 'highlight-line.svg',
			'swoosh' => 'highlight-swoosh.svg',
		],
		'anchors' => [
			'marker' => 3,   // px in original SVG units
			'line'   => 0,
			'swoosh' => 4,
		],
	]);
}, 5);

function uah_bool($v, $default=true){
	if (is_bool($v)) return $v;
	$v = strtolower(trim((string)$v));
	if (in_array($v, ['1','true','yes','on'], true)) return true;
	if (in_array($v, ['0','false','no','off'], true)) return false;
	return $default;
}

add_shortcode('uah_highlight', function($atts, $content=''){
	wp_enqueue_style('uah-style');
	wp_enqueue_script('uah-script');

	$atts = shortcode_atts([
		// styles: marker | line | swoosh
		'style'    => 'marker',
		'color'    => '',        // #hex OR Uncode color token like color-199166
		'opacity'  => '1',
		'z_index'  => '-1',      // default behind text
		'animated' => 'true',
		'duration' => '1500',    // ms
		'height'   => '0.12em',  // thickness (px/em/etc.)
		'offset'   => '0.18em',  // vertical offset from baseline (px/em/etc.)
		'angle'    => '0'        // -5.0 … +5.0 (deg)
	], $atts, 'uah_highlight');

	$style_name = strtolower(trim($atts['style']));
	if ( ! in_array($style_name, ['marker','line','swoosh'], true) ){
		$style_name = 'marker';
	}

	$opacity  = max(0.0, min(1.0, floatval($atts['opacity'])));
	$z        = intval($atts['z_index']);
	$animated = uah_bool($atts['animated'], true);
	$duration = max(100, intval($atts['duration']));
	$height   = trim($atts['height']);
	$offset   = trim($atts['offset']);

	$angle = floatval($atts['angle']);
	if ($angle > 5)  $angle = 5;
	if ($angle < -5) $angle = -5;

	// Wrapper style variables
	$style  = " --uah-z:{$z}; --uah-opacity:{$opacity}; --uah-duration:{$duration}ms;";
	$style .= " --uah-height:{$height}; --uah-offset:{$offset};";

	// Color handling:
	// If "#hex" → set --uah-color (stroke/fill use it).
	// If "color-xxxxx" (Uncode) → JS adds class text-color-xxxxx-color to each SVG.
	$svgColorClass = '';
	$color = trim($atts['color']);
	if ($color !== ''){
		if (strpos($color, 'color-') === 0){
			$svgColorClass = 'text-' . sanitize_html_class($color) . '-color';
		} elseif (preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $color)) {
			$style .= " --uah-color:{$color};";
		}
	}

	$data = sprintf(
		' data-style="%s" data-animated="%s" data-duration="%d" data-svgcolor="%s" data-angle="%s"',
		esc_attr($style_name),
		$animated ? '1' : '0',
		$duration,
		esc_attr($svgColorClass),
		esc_attr($angle)
	);

	$html  = '<span class="uah uah--style-'.esc_attr($style_name).'" style="'.esc_attr($style).'"'.$data.'>';
	$html .= '<span class="uah-text">'.do_shortcode($content).'</span>';
	$html .= '<span class="uah-layer" aria-hidden="true"></span>';
	$html .= '</span>';

	return $html;
});
