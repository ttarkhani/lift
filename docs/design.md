# Design

## Where Lifts is used

- **Stuck teams at crowded tables.** A phone held at arm's length, one hand free, bad venue lighting, glare from laptop screens nearby, and a problem that is already stressing them out. They need to post a blocker, read a reply, and tap one button without zooming.
- **Organizers on laptops.** They work through a review queue between other jobs. They need the evidence and the decision side by side, and they need to be sure which award they are acting on.
- **Judges watching a live demo.** They see the screen from across a room, projected or over a shoulder. The moment that has to land is a confirmed fix turning into a line on a receipt.

## Concept: the till and the notice board

Most of Lifts is a notice board: plain ruled lists of blockers pinned up for anyone to take. It stays quiet and legible, set in one hyperlegible typeface on a cool grey ground.

The contribution receipt is a till receipt: white paper with torn edges, set in monospace, with itemized lines, a running total, and a violet rubber-stamp mark on every line that says who confirmed it. It is the only place with a rotated element, a highlighter mark, a shadow, or a decorative edge, and the only place the monospace face is set large. The contrast between the board and the receipt is the design.

## Colors

Six named colors. Components use the tokens in `src/app/globals.css`, never raw hex values.

| Token | Hex | Role |
|---|---|---|
| `ink` | `#15181E` | Text, icons, rules (mixed with transparency for borders and secondary text) |
| `ground` | `#E9ECEF` | Page background: a cool, flat grey, so white surfaces read as paper pinned to it |
| `paper` | `#FFFFFF` | Surfaces: rows, forms, the receipt |
| `stamp` | `#4A33C8` | Primary actions, links, focus rings, and the "Confirmed by" stamp. Violet stamp-pad ink |
| `marker` | `#FFD43B` | Highlighter yellow. Only behind the receipt total and on points as they land. Never for text |
| `alert` | `#B4231A` | Errors, "Not fixed yet", reversed awards |

Derived tokens (`ink-soft` for secondary text, `rule` for borders, `stamp-wash` for selected states) are mixes of these six, defined once in the theme. Body text is `ink` on `paper` or `ground`: well above 7:1. `stamp` on `paper` is about 8:1, so it works for text and focus rings. `marker` never carries text of its own; `ink` sits on top of it.

## Type

- **Atkinson Hyperlegible Next** for everything on the board, forms, and navigation. The Braille Institute designed it for low-vision readers, and its letterforms are hard to confuse (Il1, O0) at a distance. That is exactly the arm's-length, bad-light case.
- **Atkinson Hyperlegible Mono** for the receipt, point values, invite codes, request IDs, and code snippets. It is the receipt's voice and keeps numbers in aligned columns.

Scale (rem, 16px root): `xs` 0.8125, `sm` 0.9375, `base` 1.0625 (17px body, one step larger than usual for arm's length), `lg` 1.25, `xl` 1.5, `2xl` 2. Headings are bold, not large. The only big number in the app is the receipt total.

## Space, shape, and layout

- One column, max width 40rem, 16px gutters on phones. The organizer review queue widens to 72rem on laptops, with evidence and the decision side by side.
- **Rows, not cards.** Lists are white rows separated by hairline rules inside a single bordered panel. No shadows anywhere except the receipt, which gets one hard shadow offset straight down so it looks like paper laid on the board. (A diagonal offset repeats the torn edge half a tooth sideways, which reads as a row of diamonds.)
- Radii: `sm` 4px for inputs, buttons, and tags; `md` 8px for panels. The receipt has square corners and zigzag top and bottom edges.
- Tap targets are at least 44px tall. Primary buttons are full-width on phones.
- The header is two short rows on phones (wordmark and sign-in, then Board, Leaderboard, My team) and one row from 640px.

## Status

Every status is an icon plus a word, with its own border style, so it survives grayscale, color blindness, and a projector. The icons are inline SVG, drawn at the text size, so they don't depend on font glyph coverage.

| Status | Icon | Style |
|---|---|---|
| Open | empty circle | ink outline |
| Accepted | half-filled circle | stamp outline |
| Outcome submitted | hourglass | stamp outline on stamp wash |
| Resolved | check | solid stamp, paper text |
| Under review | flag | ink dashed outline |
| Reversed | counter-clockwise arrow | alert outline; the points it held are struck through |
| Demo | diamond | ink dotted outline |

## Principles

1. **Arm's length first.** 17px body, 44px targets, one primary action per screen, and nothing that needs a hover.
2. **Quiet board, loud receipt.** Boldness is spent once. If a new screen wants a flourish, it gets a rule line instead.
3. **The same words everywhere.** A button's label and its result message match the flow table in the brief ("Help with this" → "You're helping Team Aurora").
4. **Evidence is visible.** Anything that earned points links to what proves it: the request, the outcome, and who confirmed it.
5. **Never color alone.** Status, errors, and selection always carry a word or glyph too.

## Motion

One moment: when a fix is confirmed, the new receipt line's points drop into place and the marker sweeps behind the new total (about 400ms). Under `prefers-reduced-motion: reduce`, the line simply appears with the marker already drawn. Nothing else animates beyond instant state changes.

## Review against the brief

After the first draft, we checked each choice against the setting and the looks to avoid, and changed these:

- **Status glyphs.** The draft used Unicode half-circles for both "Accepted" (◐) and "Outcome submitted" (◑). They are mirror images, and nobody can tell them apart at arm's length. Outcome submitted is now an hourglass (it is waiting on the other team), and all the icons are SVG, because font coverage for these symbols varies.
- **Where the monospace goes.** The draft said the receipt was the only place with a second typeface, but it also set code snippets, invite codes, and request IDs in mono. Those need mono to be readable (a snippet has to keep its alignment, a code has to be typed exactly), so they keep it at body size. What the receipt keeps to itself is mono at display size, the stamp, the marker, and the torn edges.
- **What stays default, on purpose.** The single column, the white panels on a grey ground, and the 4px radii are plain choices. They are what "quiet" means here, and they keep the receipt as the only thing on screen with character. The distinct parts are the hyperlegible type (chosen for the reading distance, not for fashion), the violet stamp ink standing in for the usual blue, and the receipt itself.
- **Checked against the looks to avoid.** No cream or terracotta, no dark theme with a neon accent, no gradients, no shadowed card grids, no all-caps labels, no single accent word in a headline. `marker` yellow appears only on the receipt, so it can't turn into a general accent.
- **Contrast, measured.** `ink` on `paper` 17.8:1, `ink` on `ground` 15.0:1, `stamp` on `paper` 8.1:1 (and `paper` on `stamp` for filled buttons), `stamp` on `ground` 6.8:1, `alert` on `paper` 6.6:1, `ink` on `marker` 12.5:1.
