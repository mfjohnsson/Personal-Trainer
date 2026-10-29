# DESIGN – based on Viktkoll

Reuse Viktkoll's visual language exactly. Full reference page: `viktkoll-referens.html`.

## Tokens (CSS custom properties on :root)

| Token | Light | Dark |
|---|---|---|
| --surface | #F4F7F6 | #101917 |
| --card | #FFFFFF | #18231F |
| --ink | #1B2420 | #E8EDEA |
| --ink-2 | #4A5651 | #A9B5B0 |
| --ink-3 | #7A8681 | #75817C |
| --line | #DCE3E0 | #2A3631 |
| --grid | #E7ECEA | #222E29 |
| --c-vikt (primary accent) | #2E6FD0 | #5E93EA |
| --c-vikt-soft | rgba(46,111,208,.10) | rgba(94,147,234,.14) |
| --c-midja (secondary accent) | #C05621 | #D57A35 |
| --c-midja-soft | rgba(192,86,33,.10) | rgba(213,122,53,.14) |
| --danger | #A33B2E | #E07A6B |
| --focus | = --c-vikt | = --c-vikt |
| --shadow | 0 1px 2px rgba(27,36,32,.06), 0 4px 14px rgba(27,36,32,.05) | 0 1px 2px rgba(0,0,0,.3), 0 4px 14px rgba(0,0,0,.25) |

Theme: follow `prefers-color-scheme`, with `:root[data-theme="dark"|"light"]` overrides.

New app accent mapping: blue (--c-vikt) = training/primary actions, orange (--c-midja) = food/kost. Add a success color for completed sets if needed, derived in the same muted style (e.g. #2F8A5B light / #5BBE8A dark).

## Typography
- Font stack: "Segoe UI", -apple-system, "Helvetica Neue", Roboto, sans-serif. 16px base, line-height 1.5, antialiased.
- App title (h1): 1.5rem, weight 650, letter-spacing -0.01em.
- Section labels (h2): 0.8rem, weight 600, UPPERCASE, letter-spacing .06em, color --ink-3, optional 9px colored dot before text.
- Big numbers (tiles): 1.7rem (1.45rem under 420px), weight 650, tabular-nums; unit in 0.95rem --ink-3.
- Field labels: 0.8rem weight 600 --ink-2. Notes/meta: 0.85rem --ink-3.
- All numbers use `font-variant-numeric: tabular-nums`. Swedish number format (comma decimal) via Intl sv-SE.

## Layout
- `main`: max-width 660px, centered, padding 24px 16px 64px, flex column, gap 16px.
- Header: title left, meta right (e.g. "v. 44" in --ink-3).
- Stat tiles: 2-column grid, gap 12px.

## Components
- **Card**: --card bg, 1px --line border, radius 10px, --shadow, padding 16px.
- **Input**: padding 10px 12px, 1.05rem, --surface bg, 1px --line border, radius 8px, focus outline 2px --focus offset 1px. Numeric inputs: `type=text inputmode=decimal`, accept comma.
- **Primary button**: full width in forms, padding 12px, 1rem weight 600, white text on --c-vikt, no border, radius 8px.
- **Secondary button**: --card bg, 1px --line border, --ink-2 text, weight 600, 0.9rem, radius 8px, padding 8px 14px.
- **Destructive inline**: transparent, --ink-3 text; two-step confirm turns it --danger with border.
- **Table**: uppercase 0.75rem headers in --ink-3, rows separated by --grid lines, numbers right-aligned.
- **Dialog**: card styling, width min(92vw, 480px), backdrop rgba(0,0,0,.35).
- **Chart (SVG)**: height 200, grid lines --grid, axis labels 11px --ink-3, line stroke 2px accent, soft area fill (--*-soft), points r=3 hollow (--card fill), last point r=4.5 filled + bold direct label, dashed crosshair + dark tooltip on pointer.
- **Form note**: aria-live polite, short Swedish confirmation ("Sparat: 29 okt (v. 44).").

## New components needed (same style)
- **Bottom nav**: fixed bottom, 4 items (Idag / Vecka / Kost / Profil), --card bg, top 1px --line border, min 56px tall, active item in --c-vikt with label; respect safe-area-inset-bottom.
- **Set checkbox row**: whole row tappable (min 48px), exercise name + "3 × 8–12" in tabular-nums, round check that fills with accent when done.
- **Day chip**: short weekday + status dot (done / today / upcoming).

## Behaviour
- Respect `prefers-reduced-motion`. Visible focus outlines. No horizontal scroll at 360px.
- Copy Viktkoll's tone: short, plain Swedish microcopy.
