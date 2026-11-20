# Premium Design & Editorial Craft Rules

## 1. Anti-Cliché & Visual Restraint
- NEVER use generic AI defaults: no glowing purple/cyan gradients, no 3-column icon-above-text feature grids, and no heavy drop shadows.
- Rely on subtle 1px hairline borders (`border-white/10` on dark or `border-black/10` on light) and tonal surface shifts to separate content instead of thick boxes.
- Enforce generous negative space: use wide vertical section padding (`py-24` to `py-32`) and tight internal element grouping.

## 2. Editorial Typography
- Pair an expressive display font (e.g., Plus Jakarta Sans, Instrument Sans, or Playfair Display) for headings with a clean geometric sans-serif (e.g., Inter or Geist) for body copy.
- Apply tight letter-spacing (`tracking-tight` or `-0.03em`) and tight line-height (`leading-[1.08]`) on large headlines.
- Use `tabular-nums` for any metrics, pricing, or data points.

## 3. Color & Surface Depth
- Commit to a strict, restrained palette: 1 primary background surface, 1 elevated surface (`+4%` lightness shift), 1 crisp ink color, muted secondary text (`60%` opacity), and a single high-contrast accent color used sparingly for primary CTAs.
- Add subtle radial lighting or fine grain textures to hero backgrounds rather than flat solid colors.

## 4. Choreographed Motion & Tactile Feedback
- Animate only GPU-composited properties (`transform` and `opacity`) with custom cubic-bezier easing (`[0.16, 1, 0.3, 1]`).
- Add subtle tactile micro-interactions: button press scale (`active:scale-[0.98]`), smooth link underlines, and staggered entrance reveals (`40ms`–`60ms` delay between items).
