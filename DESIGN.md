# Factory Console Design System

## Theme

A dense, dark command surface for a developer working on a 1440px desktop in a focused environment. Deep blue-tinted neutrals reduce glare; restrained blue, cyan, green, violet, and amber communicate real workflow state rather than decorate the page.

## Color Strategy

Restrained, state-rich palette expressed with OKLCH tokens. The main accent is operational blue. Cyan identifies candidate testing, violet identifies human review, green means verified or connected, amber means rework or warning, and red is reserved for failure.

## Typography

Use a single system sans stack for Chinese and English UI text. Use a compact fixed type scale, tabular numerals for metrics and timestamps, and a monospace stack only for commands, branches, paths, and redacted output.

## Layout

- 216px desktop sidebar, 64px top command bar, and a content grid tuned for 1440px.
- 8px spacing grid with intentionally varied panel padding.
- Full-width pipeline stepper, followed by a two-column operational region.
- Below 960px, the sidebar becomes a horizontal navigation rail and dense two-column areas stack.
- Below 640px, metric cards become a two-column grid and wide tables use contained horizontal scrolling.

## Surfaces and Elevation

Use opaque navy surfaces with fine blue-gray borders. Avoid blur and large-area gradients. Elevation comes from subtle luminance differences and selective inset highlights, not shadows stacked on cards.

## Components

- Controls share a 6px radius, explicit hover/focus/disabled/loading states, and 40px minimum pointer targets.
- Metrics use outlined circular icon wells plus label and tabular count.
- Pipeline stages use consistent icon rings, semantic connectors, textual state badges, and branch responsibility labels.
- Lists and tables use dividers instead of nested cards.
- Confirmation uses a focused dialog only for high-risk allowlisted commands because side effects must be reviewed before execution.
- Empty, unavailable, error, demo, and loading states are visually distinct and translated.

## Motion

Use 160–220ms ease-out transitions only for state changes, disclosure, focus, and loading feedback. Disable non-essential motion under `prefers-reduced-motion`.

## Visual References

The supplied Chinese and English dashboard artwork defines information hierarchy, density, component proportions, and the bilingual layout contract. Both locales must render from identical components and data.
