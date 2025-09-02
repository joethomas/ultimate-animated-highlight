# Ultimate Animated Highlight

Bring attention to any words or phrases with smooth, line-by-line highlights. Easy to use, theme-friendly, and accessible.

## Features
- Three highlight styles: **marker**, **line**, **swoosh**
- Animates one line at a time (works across line breaks)
- Use your theme color or a hex color
- Place highlights behind or in front of text
- Respects Reduced Motion accessibility settings

## Installation
1. Upload the `ultimate-animated-highlight` folder to `wp-content/plugins/`.
2. Activate **Ultimate Animated Highlight** in **Plugins**.
3. Use the shortcode in any post, page, or block.

## Quick Start
Use the default settings:  
`[uah_highlight]Elevate Your Space[/uah_highlight]`

## Shortcode
`[uah_highlight]…your text…[/uah_highlight]`

### Attributes
- `style` — `marker` | `line` | `swoosh` (default: `marker`)
- `color` — a hex like `#c1b580`, or a theme color ID like `color-199166` (for Uncode themes)
- `opacity` — `0.0` to `1.0` (default: `1`)
- `z_index` — any integer (default: `-1` puts highlight behind the text)
- `animated` — `true` or `false` (default: `true`)
- `duration` — milliseconds (default: `1500`)
- `height` — thickness, accepts `em`/`px` (default: `0.12em`)
- `offset` — vertical position, accepts `em`/`px` (default: `0.18em`)
- `angle` — `-5.0` to `+5.0` degrees (default: `0`)

> Using Uncode? Pass `color="color-XXXXX"` (for example, `color-199166`) to use your theme’s color.

## Examples
**Marker (defaults):**  
`[uah_highlight]Elevate Your Space[/uah_highlight]`

**Marker with Uncode color, tuned thickness/offset/angle:**  
`[uah_highlight style="marker" color="#ffd54f" opacity="0.6" z_index="1" duration="1800" height="1.0em" offset="0em" angle="0"]Elevate Your Space[/uah_highlight]`

**Marker with hex color highlighting on top of the text:**
`[uah_highlight style="marker" color="color-199166" height="0.10em" offset="0.20em" angle="-1.5" duration="1200"]Elevate Your Space[/uah_highlight]`

**Swoosh above the text (front):**  
`[uah_highlight style="swoosh" color="#c1b580" opacity="0.9" z_index="1" height="0.12em" offset="0.14em" duration="1000"]Timeless Style[/uah_highlight]`

**Line with a slower draw:**  
`[uah_highlight style="line" color="#ffd54f" height="0.16em" offset="0.22em" duration="2000"]Designed for Every Room[/uah_highlight]`

**No animation (static highlight):**  
`[uah_highlight style="marker" animated="false" height="0.11em" offset="0.18em"]Calm & Collected[/uah_highlight]`

## Tips
- If the highlight looks too thick or thin, adjust `height`.
- If it sits too close/far from the text, adjust `offset`.
- Set `z_index="1"` to place the highlight over text, images, or decorative backgrounds.

## Accessibility
- The highlight layer is decorative and hidden from assistive technologies.
- Animations respect the user’s Reduced Motion preference.
