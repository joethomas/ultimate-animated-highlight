<?php
/*
	Plugin Name: Ultimate Animated Highlight
	Description: Line-by-line animated highlights (marker, line, swoosh) with exact SVG curves and per-line animation.
	Version: 1.0.0
	Author: Joe Thomas
	License: GPLv2 or later
	Text Domain: ultimate-animated-highlight

	GitHub Plugin URI: joethomas/ultimate-animated-highlight
	Primary Branch: main
*/
if ( ! defined('ABSPATH') ) exit;

define( 'UAH_VER', $plugin['Version'] );
define( 'UAH_TEXTDOMAIN', $plugin['TextDomain'] );
define( 'UAH_DIR', plugin_dir_path( __FILE__ ) );
define( 'UAH_URL', plugin_dir_url( __FILE__ ) );
define( 'UAH_PATH', plugin_dir_path( __FILE__ ) );
define( 'UAH_PREFIX', 'uah' );

add_action('wp_enqueue_scripts', function () {
	wp_register_style(UAH_PREFIX . '-style', UAH_URL.'assets/uah.css', [], UAH_VER);
	wp_register_script(UAH_PREFIX . '-script', UAH_URL.'assets/uah.js', [], UAH_VER, true);

	// Provide asset locations + baseline anchors to JS
	wp_localize_script('uah-script', 'UAH_ASSETS', [
		'base'    => UAH_URL.'assets/',
		'svgs'    => [
			'marker' => 'highlight-marker.svg',
			'line'   => 'highlight-line.svg',
			'swoosh' => 'highlight-swoosh.svg',
		],
		'anchors' => [
			'marker' => 30,   // px in original SVG units
			'line'   => 0,
			'swoosh' => 15,
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

	// What the user actually typed (to know which to override)
	$raw = $atts;

	// Normalize + provide null defaults so we can safely read values
	$atts = shortcode_atts([
		'style'    => 'marker',
		'color'    => null,   // #hex or color-xxxxx
		'opacity'  => null,   // 0.0 to 1.0
		'width'    => null,   // 0.8 to 1.2
		'height'   => null,   // thickness of highlight
		'offset'   => null,   // distance from baseline (<0 is up; >0 is down)
		'curve'    => null,   // 0.0 to 1.0 - flatness of curve; applies to marker and swoosh
		'angle'    => null,   // -5.0 to 5.0
		'z_index'  => null,   // integer
		'animated' => null,   // true or false
		'duration' => null    // duration in ms
	], $atts, 'uah_highlight');

	$style_name = strtolower(trim($atts['style'] ?? 'marker'));
	if (!in_array($style_name, ['marker','line','swoosh'], true)) $style_name = 'marker';

	$vars = [];

	// curve → map per style (ignore for "line")
	if (array_key_exists('curve', $raw)) {
		$cv = floatval($atts['curve']);
		if (!is_finite($cv) || $cv < 0) $cv = 0;
		if ($cv > 1) $cv = 1; // soft cap
		if ($style_name === 'marker')      $vars[] = '--uah-curve-marker:'.$cv;
		elseif ($style_name === 'swoosh')  $vars[] = '--uah-curve-swoosh:'.$cv;
	}

	// Only set vars the user actually provided (don’t stomp CSS defaults)
	if (array_key_exists('width', $raw)) {
    	$wf = floatval($atts['width']);
    	if (!is_finite($wf)) $wf = 1;
    	if ($wf < 0.5) $wf = 0.5;
    	if ($wf > 1.2) $wf = 1.2;
    	$vars[] = '--uah-width:'.$wf;
    }
    
	if (array_key_exists('height', $raw))   $vars[] = '--uah-height:'.trim($atts['height']);
	if (array_key_exists('offset', $raw))   $vars[] = '--uah-offset:'.trim($atts['offset']);
	if (array_key_exists('opacity', $raw))  $vars[] = '--uah-opacity:'.max(0.0, min(1.0, floatval($atts['opacity'])));
	if (array_key_exists('z_index', $raw))  $vars[] = '--uah-z:'.intval($atts['z_index']);
	if (array_key_exists('duration', $raw)){
		$d = intval($atts['duration']); if ($d < 0) $d = 0;
		$vars[] = '--uah-duration:'.$d.'ms';
	}
	if (array_key_exists('color', $raw)) {
		$color = trim($atts['color']);
		if (preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $color)) {
			$vars[] = '--uah-color:'.$color;
		}
		// Uncode token handled via data-svgcolor below
	}

	$style_attr = $vars ? ' style="'.esc_attr(implode(';',$vars)).'"' : '';

	// Data flags
	$animated = ! (isset($atts['animated']) && in_array(strtolower($atts['animated']), ['0','false','no','off'], true));

	$angle_attr = '';
	if (array_key_exists('angle', $raw)) {
		$ang = floatval($atts['angle']);
		if ($ang > 5)  $ang = 5;
		if ($ang < -5) $ang = -5;
		$angle_attr = ' data-angle="'.esc_attr($ang).'"';
	}

	$svgColorClass = '';
	if (!empty($atts['color']) && strpos($atts['color'], 'color-') === 0){
		$svgColorClass = 'text-'.sanitize_html_class($atts['color']).'-color';
	}

	$data = sprintf(
		' data-style="%s"%s%s%s',
		esc_attr($style_name),
		$animated ? ' data-animated="1"' : ' data-animated="0"',
		$svgColorClass ? ' data-svgcolor="'.esc_attr($svgColorClass).'"' : '',
		$angle_attr
	);

	$html  = '<span class="uah uah--style-'.esc_attr($style_name).'"'.$style_attr.$data.'>';
	$html .= '<span class="uah-text">'.do_shortcode($content).'</span>';
	$html .= '<span class="uah-layer" aria-hidden="true"></span>';
	$html .= '</span>';
	return $html;
});
