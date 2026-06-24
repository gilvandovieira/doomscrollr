# Accessibility Contrast Matrix

Last audited: 2026-06-24

Doomscrollr targets WCAG AA for core UI text and controls: normal text at least 4.5:1, large/bold
text at least 3:1. The automated guard is `apps/web/src/a11y/contrast_test.ts`; it parses the
committed CSS tokens from `apps/web/src/styles.css` and fails when any enforced pairing drops below
4.5:1.

## Enforced Pairs

| Theme |                          Pair family | Minimum observed |
| ----- | -----------------------------------: | ---------------: |
| Light |    `ink` on page / paper / newsprint |          16.70:1 |
| Light |  `muted` on page / paper / newsprint |           4.98:1 |
| Light | `signal` on page / paper / newsprint |           4.71:1 |
| Light |  `oxide` on page / paper / newsprint |           4.63:1 |
| Light |    `ink` on `accent-soft` chip fills |          15.13:1 |
| Light |      `pitch` on signal / oxide fills |           4.98:1 |
| Light |       `pitch-ink` on post-kind fills |           5.05:1 |
| Light |  `pitch-ink` on WhatsApp green fills |           7.47:1 |
| Dark  |    `ink` on page / paper / newsprint |          15.33:1 |
| Dark  |  `muted` on page / paper / newsprint |           9.89:1 |
| Dark  | `signal` on page / paper / newsprint |           4.57:1 |
| Dark  |  `oxide` on page / paper / newsprint |           4.84:1 |
| Dark  |    `ink` on `accent-soft` chip fills |           8.94:1 |
| Dark  |      `pitch` on signal / oxide fills |           4.76:1 |
| Dark  |       `pitch-ink` on post-kind fills |           5.05:1 |
| Dark  |  `pitch-ink` on WhatsApp green fills |           7.47:1 |

## Decisions

- Light-theme `--muted` is intentionally `oklch(var(--color-ink) / 0.85)`. Lower alphas looked
  calmer but failed AA on paper/newsprint surfaces.
- Dark-theme `--color-pitch` flips to the dark ink token. The dark accent fills are brighter than
  the light accent fills, so white text no longer met 4.5:1 there.
- Post-kind fills and the WhatsApp share fill use `--color-pitch-ink` for foreground text because
  those fills are bright brand/status colors.
- Tag chips and bottom navigation active states use ink foregrounds over the soft accent tint;
  signal text on that tint fails real axe/browser contrast checks.
