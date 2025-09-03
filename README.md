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

## Get Updates
1. Install the free **Git Updater** plugin (by Andy Fragen).
2. Activate it, then go to **Settings → Git Updater**.
4. Force a check: go to **Dashboard → Updates** and click **Check Again**, or in **Settings → Git Updater** click **Refresh Cache**.
6. When a new version is released, updates will appear in **Plugins** like any other WP update. You can also enable **Auto-updates** for this plugin on the Plugins screen.

## Quick Start
Use the default settings:  
`[uah_highlight]My Cool Heading[/uah_highlight]`

### Attributes
- `style` — `marker` | `line` | `swoosh` (default: `marker`)
- `color` — a hex like `#c1b580`, or a theme color ID like `color-199166` for Uncode themes (default: theme color)
- `opacity` — `0.0` to `1` (default: `1`)
- `width` - `0.5` to `1.2` (default: `1`)
- `height` — thickness, accepts `em`/`px` (default: `0.1em`)
- `offset` — vertical position, accepts `em`/`px` (default: `0.18em`)
- `curve` — `0.0` (flat) to `1.0` (curved) - applies to styles `marker` and `swoosh` (default: `0`)
- `angle` — `-5.0` (up) to `5.0` (down) degrees (default: `0`)
- `z_index` — any integer (default: `-1` puts highlight behind the text)
- `animated` — `true` or `false` (default: `true`)
- `duration` — milliseconds (default: `1500`)

> Using Uncode? Pass `color="color-XXXXX"` (for example, `color-199166`) to use your theme’s color.

## Examples
**Marker (defaults):**  
`[uah_highlight]My Basic Highlight[/uah_highlight]`

**Marker with Uncode color, tuned thickness/offset/curve/angle:**  
`[uah_highlight style="marker" color="color-199166" height="0.10em" offset="0.20em" curve="0.20" angle="-1.5" duration="1200" width="1"]My Uncode Headline[/uah_highlight]`

**Swoosh above the text (front):**  
`[uah_highlight style="swoosh" color="#c1b580" opacity="0.9" z_index="1" height="0.13em" offset="0.20em" curve="0.28" angle="-1.1" duration="1500" width="1.2"]Ooooooh. Fancy.[/uah_highlight]`

**Line with a slower draw:**  
`[uah_highlight style="line" color="#6600ee" height="0.16em" offset="0.22em" duration="2000" width="0.8"]Far Out![/uah_highlight]`

**No animation (static highlight):**  
`[uah_highlight style="marker" color="#77bb99" animated="false" height="0.11em" offset="0.18em"]Calm & Collected[/uah_highlight]`

**Others:**
`[uah_highlight style="marker" color="#ff3300" width="0.5" curve="0" height="0.10em" offset="0.05em"]Tight Fit[/uah_highlight]`

`[uah_highlight style="swoosh" color="#ffd54f" width="1.1" height="0.12em" offset="0.18em" curve="0.30"]Smooth Accent[/uah_highlight]`

`[uah_highlight style="line" color="#333333" opacity="0.7" z_index="2" height="0.14em" offset="0.16em" duration="1800" width="1.05"]Headline Highlight[/uah_highlight]`

## Tips
- If the highlight looks too thick or thin, adjust `height`.
- If it sits too close or far from the text, adjust `offset`.
- Set `z_index="1"` to place the highlight over text, images, or decorative backgrounds.

## Accessibility
- The highlight layer is decorative and hidden from assistive technologies.
- Animations respect the user’s Reduced Motion preference.
