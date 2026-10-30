# UX39 — Uniform mobile dock and no duplicate in-game anchor links

## Root cause (verified in UX38 main)

The 5-tab dock (Trang chủ, Học, Chơi, Thi đấu, Tiến độ) was built by
`public/shared-nav.js`, but `updateActive()` explicitly hid it for
MATCH/BOMB/CAR Solo, room competition, falling-letter play, MATRIX and
MEMORY screens. Separately, the only CSS defining `.ws-mobile-dock`
lived in `public/ux02-home-nav.css`, included by Arena/Learn/Progress
but missing from the new standalone MATRIX, MEMORY, practice and other
pages. Changing only JavaScript would not fix those standalone pages.

## UX39 changes

- Move bottom-dock styling intact from UX02 Home-only stylesheet into
  `public/shared-nav.css`, which every relevant page already loads.
- Remove automatic route-based dock hiding. All five destinations keep
  their existing deep links, active state, keyboard access and semantic
  `<a>` markup **inside the global navigation**.
- Preserve content spacing, bottom safe-area insets and scroll margins
  for touch-input fields and room actions so the fixed dock does not
  obscure the bottom of content at 360/390px.
- Remove only redundant `<a>` navigation in MATRIX/MEMORY result panels
  and the former MATCH/BOMB/CAR Solo result CTA. Preserve gameplay
  actions such as **Chơi lại** and game-entry links from the Home game
  library, since removing those would make some games unreachable.
- Desktop retains the top header, with the mobile dock hidden above
  680px. No duplicate in-game navigation widgets.

## Verification and safeguards

1. Unit regression for shared CSS loading on Arena/Learn/MATRIX/MEMORY,
   My Learning, practice, personal vocabulary and mistakes notebook.
2. Isolated Chromium + Firefox browser QA at 360 and 390px: verify all
   five tabs, expected active state in each route, navigation from
   MATRIX to Thi đấu to MATCH, fixed-position dock, body safe-area
   spacing, non-obscured room join and new-game start actions.
3. Static regression asserts no extra links inside MATRIX/MEMORY result
   panels or the legacy Solo result template. **Do not remove actual
   navigation links** from global menus or game-library tiles.
4. All tests and CI on exact PR commit before any Vercel deployment;
   only one manually authorized isolated Preview, then review/merge.
5. Current Production is UX37 while UX38 has already merged into main.
   When UX39 is approved, combine UX38 and UX39 in **one** subsequent
   manual Production deployment after smoke checks, to conserve builds.

No API, game score, SRS, learning schedule, database migration,
credentials or Production user records are modified by UX39.
