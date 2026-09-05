# RecoveryOS — Slush-inspired workspace

The dashboard adapts https://slush.app/ and its Refero design reference to payment operations. Keep the existing RecoveryOS identity and evidence-backed workflows.

## Visual foundations

- Canvas: paper #f5f5f0; hero: sky wash #dceeff.
- Sticker surfaces: blue #4da2ff, mint #55db9c, lavender #e9ccff, yellow #ffd731, and warm peach. Use dark text on these surfaces.
- Typography: oversized uppercase Impact / Arial Narrow display headlines; Arial / Helvetica for readable operational text. Display lettering stays separate from table and form typography.
- Major cards use 24–32px corners, thin dark outlines, and flat fills. Navigation and primary actions use black pills. Avoid glows, ambient effects, and glass surfaces.
- The decorative recovery loop is a local SVG with blue shading and small sticker accents. It conveys branding, not operational state.

## Application patterns

The command center pairs a visual recovery banner with four live summary cards, a recovery lifecycle, health and attention queues, attributed outcomes, and recent activity. Preserve source labels, error states, and payment attribution. Never add fabricated financial values to improve presentation.

All operator routes share the same navigation, controls, pastel surfaces, tables, drawers, and footer. Mobile uses collapsible navigation and stacked content. Keyboard focus stays visible; reduced-motion preferences are respected.

Base structural styles are in globals.css; the shared visual theme is in slush.css, imported after the base stylesheet in the root layout.
