# Design

## Where Lifts is used

- **Stuck teams at crowded tables.** A phone held at arm's length, one hand free, bad venue lighting, glare from laptop screens nearby, and a problem that is already stressing them out. They need to post a blocker, read a reply, and tap one button without zooming.
- **Organizers on laptops.** They work through a review queue between other jobs. They need the evidence and the decision side by side, and they need to be sure which award they are acting on.
- **Judges watching a live demo.** They see the screen from across a room, projected or over a shoulder. The moment that has to land is a confirmed fix turning into a line on a receipt.

## Concept: the till and the notice board, in Hack the Hill colors

Most of Lifts is a notice board: plain ruled lists of blockers pinned up for anyone to take. It stays quiet and legible, set in one hyperlegible typeface on a warm cream ground.

The contribution receipt is a till receipt: paper with torn edges, set in monospace, with itemized lines, a running total, and a maroon rubber-stamp mark on every line that says who confirmed it. It is the only place with a rotated element, a highlighter mark, a shadow, or a decorative edge, and the only place the monospace face is set large. The contrast between the board and the receipt is the design.

## Theme: Hack the Hill III

Lifts is built for Hack the Hill III, so it wears the event's colors: the golden sky and maroon buildings of hackthehill.com, and the sand header, maroon pills, and terracotta-to-peach hero of the event's tracker app. **Our brand, their mood.** Lifts keeps its own name, wordmark, and arrow icon. The resemblance comes only from palette, type, and shape. We don't use or redraw their logo, wordmark, illustrations, leaf artwork, or the MLH badge, and we don't load any of their files. The three leaves in the landing hero are simple ovals drawn from scratch. The only mention of the event is the footer line "Built at Hack the Hill III" and the event dates in the hero; Lifts is not an official Hack the Hill product.

The hex values come from the sites' own CSS (the root variables on hackthehill.com and the tracker's stylesheet), not from eyedropping screenshots.

## Colors

The six named colors keep their names and roles from the first design; only their values changed, so every component picked up the theme without edits. Components use the tokens in `src/app/globals.css`, never raw hex values.

| Token | Hex | Source | Role |
|---|---|---|---|
| `ink` | `#650014` | Tracker `--color-ink` | Text, icons, rules (mixed with transparency for borders and secondary text) |
| `ground` | `#FFF3B6` | Site `--light-primary-color` (cream) | Page background, and the outline on the hero lettering |
| `paper` | `#FFFBE6` | Cream lightened toward white | Surfaces: rows, forms, the receipt |
| `stamp` | `#84010B` | Site `--dark-primary-color` (maroon) | Primary buttons, links, focus rings, the current page pill, and the "Confirmed by" stamp |
| `marker` | `#F6BF70` | Site `--light-tertiary-color` (golden) | Highlighter. Only behind the receipt total and on points as they land. Never for text |
| `alert` | `#C11F25` | Site `--medium-tertiary-color` (brick) | Errors, "Not fixed yet", reversed awards. Defined as `var(--color-brick)` |

Theme-only tokens, used by the header and the landing hero:

| Token | Hex | Source | Role |
|---|---|---|---|
| `brick` | `#C11F25` | Site `--medium-tertiary-color` | The "Lifts" hero lettering |
| `sand` | `#F5C18C` | Tracker header (`bg-light-quaternary-color`) | Header bar |
| `sunset-1` to `sunset-4` | `#C7734F`, `#EA8A60`, `#EE9E6F`, `#F6BC83` | Tracker `.bg-default-gradient` | The hero gradient (`bg-sunset`), top to bottom |

The brief's approximate values were close to these. We used the real ones: maroon is `#84010B`, not `#6B1115`; brick is `#C11F25`, not `#B0303A`; cream is the site's yellow-leaning `#FFF3B6`, not `#FAF3E8`; the theme color `#EA885F` sits between `sunset-1` and `sunset-2` (the tracker's own is `#EA8A60`).

Derived tokens are oklab mixes defined once in the theme: `ink-soft` (82% ink into paper) for secondary text, `rule` (22%) for borders, `stamp-wash` (9%) for selected states, `alert-wash` (8%) behind errors. `ink-soft` went from 72% to 82% so that secondary paragraphs still reach 7:1 on the cream ground.

## Type

- **Atkinson Hyperlegible Next** for body text, forms, and anything read at length. The Braille Institute designed it for low-vision readers, and its letterforms are hard to confuse (Il1, O0) at a distance. That is exactly the arm's-length, bad-light case, so it stays.
- **Rubik** for headings (`h1`–`h3`), the wordmark, the nav pills, and the hero. It's Hack the Hill's own interface face, open-licensed (OFL), and loaded through `next/font`. We didn't use it for body text: its `I`, `l`, and `1` are plain strokes that blur together at a distance, which Atkinson was chosen to avoid.
- **Coolvetica**, the event's display face, is a commercial Typodermic font and not on Google Fonts, so we don't load it. The hero sets "Lifts" in Rubik ExtraBold instead, which keeps its heavy, rounded feel without a third family. (Highway Gothic, used in the site's scenery, isn't needed.)
- **Atkinson Hyperlegible Mono** for the receipt, point values, invite codes, request IDs, and code snippets. It is the receipt's voice and keeps numbers in aligned columns. The receipt's team heading sets `font-mono` explicitly, because headings default to Rubik.

Scale (rem, 16px root): `xs` 0.8125, `sm` 0.9375, `base` 1.0625 (17px body, one step larger than usual for arm's length), `lg` 1.25, `xl` 1.5, `2xl` 2, and `hero` (`clamp(4.5rem, 24vw, 8rem)`) for the one word on the landing page. Headings are bold, not large. The only big number in the app is the receipt total.

## Space, shape, and layout

- One column, max width 40rem, 16px gutters on phones. The organizer review queue widens to 72rem on laptops, with evidence and the decision side by side.
- **Rows, not cards.** Lists are white rows separated by hairline rules inside a single bordered panel. No shadows anywhere except the receipt, which gets one hard shadow offset straight down so it looks like paper laid on the board. (A diagonal offset repeats the torn edge half a tooth sideways, which reads as a row of diamonds.)
- Radii: `sm` 6px for inputs, tags, and badges; `md` 12px for panels and buttons (close to the rounded "Apply Now" on hackthehill.com); `full` for the current-page pill and the event-date pill. The receipt has square corners and zigzag top and bottom edges.
- Tap targets are at least 44px tall. Primary buttons are full-width on phones.
- The header is a sand bar with a maroon bottom rule, like the tracker's. It's two short rows on phones (wordmark and sign-in, then Board, Leaderboard, My team) and one row from 640px. The current page is a filled maroon pill with cream text; the others are maroon text that turns into a cream pill on hover.
- Buttons: primary is filled maroon with cream text and turns ink on hover; secondary is outlined in maroon with maroon text on paper; danger is outlined in brick.
- The landing page opens with a full-width hero band on the `sunset` gradient: "Lifts" in brick with a cream outline and a hard maroon shadow, the event line "Sept. 25–27, 2026 at uOttawa" in a maroon pill, the tagline, and the sign-in actions. The explanatory paragraph sits below the band on cream, because it's body text and the gradient's top stop can't carry 7:1.
- Every page ends with a footer line, "Built at Hack the Hill III".

## Status

Every status is an icon plus a word, with its own border style, so it survives grayscale, color blindness, and a projector. The icons are inline SVG, drawn at the text size, so they don't depend on font glyph coverage.

| Status | Icon | Style |
|---|---|---|
| Open | empty circle | ink outline |
| Accepted | half-filled circle | stamp outline |
| Outcome submitted | hourglass | stamp outline on stamp wash |
| Resolved | check | solid stamp (maroon), paper text |
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

One moment: when a fix is confirmed, the new receipt line's points drop into place and the marker sweeps behind the new total (about 400ms). Under `prefers-reduced-motion: reduce`, the line simply appears with the marker already drawn. Nothing else animates beyond instant state changes. The hero leaves are still.

## Review against the brief

This review is of the first design (grey ground, violet stamp). The Hack the Hill theme above replaced its colors, radii, and the "no cream, no terracotta, no gradients" rule on purpose, to match the event; the gradient stays in the landing hero only. The rest still holds.

After the first draft, we checked each choice against the setting and the looks to avoid, and changed these:

- **Status glyphs.** The draft used Unicode half-circles for both "Accepted" (◐) and "Outcome submitted" (◑). They are mirror images, and nobody can tell them apart at arm's length. Outcome submitted is now an hourglass (it is waiting on the other team), and all the icons are SVG, because font coverage for these symbols varies.
- **Where the monospace goes.** The draft said the receipt was the only place with a second typeface, but it also set code snippets, invite codes, and request IDs in mono. Those need mono to be readable (a snippet has to keep its alignment, a code has to be typed exactly), so they keep it at body size. What the receipt keeps to itself is mono at display size, the stamp, the marker, and the torn edges.
- **What stays default, on purpose.** The single column, the white panels on a grey ground, and the 4px radii are plain choices. They are what "quiet" means here, and they keep the receipt as the only thing on screen with character. The distinct parts are the hyperlegible type (chosen for the reading distance, not for fashion), the violet stamp ink standing in for the usual blue, and the receipt itself.
- **Checked against the looks to avoid.** No cream or terracotta, no dark theme with a neon accent, no gradients, no shadowed card grids, no all-caps labels, no single accent word in a headline. `marker` yellow appears only on the receipt, so it can't turn into a general accent.
- **Contrast, measured.** `ink` on `paper` 17.8:1, `ink` on `ground` 15.0:1, `stamp` on `paper` 8.1:1 (and `paper` on `stamp` for filled buttons), `stamp` on `ground` 6.8:1, `alert` on `paper` 6.6:1, `ink` on `marker` 12.5:1.

## Contrast, Hack the Hill theme

Measured with the WCAG 2 formula on the final hex values; derived tokens were computed from their oklab mixes (`ink-soft` `#843636`, `stamp-wash` `#F6E6D1`, `alert-wash` `#FDEBD6`). Targets: 7:1 for body text, 4.5:1 for other text, 3:1 for component edges.

| Text | Background | Ratio | Where |
|---|---|---|---|
| `ink` | `paper` | 12.9:1 | Body text in rows, forms, the receipt |
| `ink` | `ground` | 12.0:1 | Body text on the page |
| `ink` | `sand` | 8.2:1 | Team name and nav links in the header |
| `ink` | `stamp-wash` | 11.0:1 | Selected chips, the thread notice, status messages |
| `ink` | `alert-wash` | 11.5:1 | Text inside error panels |
| `ink` | `marker` | 8.1:1 | The receipt total |
| `ink` | `sunset-2` / `sunset-3` / `sunset-4` | 5.3 / 6.2 / 8.0:1 | The hero tagline (large bold), which sits below the gradient's top stop |
| `ink-soft` | `paper` | 7.9:1 | Secondary text in rows and on the receipt |
| `ink-soft` | `ground` | 7.3:1 | Page descriptions, the footer |
| `stamp` | `paper` | 10.2:1 | Links, secondary buttons, the stamp |
| `stamp` | `ground` | 9.4:1 | Links on the page |
| `stamp` | `sand` | 6.5:1 | Wordmark and "Log in" in the header |
| `stamp` | `stamp-wash` | 8.6:1 | "Outcome submitted" badge |
| `paper` | `stamp` | 10.2:1 | Primary buttons, the current-page pill, the event pill, "Resolved" |
| `paper` | `ink` | 12.9:1 | Primary buttons on hover |
| `alert` | `paper` | 5.8:1 | Error messages, danger buttons |
| `alert` | `ground` | 5.4:1 | Error text on the page |
| `alert` | `alert-wash` | 5.2:1 | Error panels, the "Reversed" badge |
| `stamp` edge | `sunset-1` | 3.0:1 | Button outlines against the top of the hero |

Pairs we avoid: white or cream text on the light orange stops (1.5–2.5:1), `ink-soft` on `sand` (5.0:1, fine for secondary text but not needed there, so the header uses `ink`), and `brick` on the gradient (1.7–3.6:1). The hero lettering is brick, but its edges are the cream outline against a maroon shadow (9.4:1) and brick against cream (5.4:1), so the word reads by its outline rather than by its fill against the gradient. Input and panel borders (`rule`) are 1.6:1 against paper, as in the first design; inputs darken to `ink` on hover and show the maroon focus ring.
