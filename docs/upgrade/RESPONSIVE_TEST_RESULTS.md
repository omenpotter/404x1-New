# Responsive Test Results

Command: `NODE_USE_ENV_PROXY=1 node tests/e2e/responsive.cjs --json docs/upgrade/live/responsive-results.json` (real Chromium against the production build served by `vite preview`; X1 RPC calls are relayed read-only to X1 mainnet; Base44 calls are aborted (logged-out run) or answered by **test-only synthetic fixtures** (`tests/e2e/backend-fixtures.cjs`, signed-in run — layout only, not real data)).

Matrix: 10 routes (Home, Chat, Messages, Game, Leaderboard, Docs, Profile, ModPanel, ModerationLogs, unknown-route 404) × widths **320, 375, 390, 430, 768, 1024, 1440, 1920, 2560** × {logged-out, signed-in fixtures} = 180 page loads. Touch emulation on < 1024px.

| Check | Result |
|---|---|
| Horizontal page overflow (scrollWidth > viewport) | **0 of 180** |
| Elements positioned beyond the viewport outside a scroll container | **0** |
| Navigation (burger → drawer → Escape at ≤ 768 and 1440 inline links) | pass at all sampled widths |
| Uncaught page errors / app console errors | **0** |
| Keyboard: first Tab stop is the skip link | pass |
| `prefers-reduced-motion`: rain hidden, 0 running infinite animations | pass |
| axe-core wcag2a/2aa/21aa (Home + 8 pages, desktop + mobile, both states) | **0 violations** |

Bugs found by this suite and fixed in this phase:
1. Layout shell created a stacking context that put the empty toast viewport above the nav → mobile menu button unclickable (fixed: no z-index on `.ds-shell`).
2. Logged-in nav overflowed 143px at 1024px (fixed: burger breakpoint 1120px, label collapse to 1320px).
3. `ModerationLogs`: unlabeled `<select>` and non-focusable scroll region (labelled; region made focusable).
4. `ModPanel`: `#2a3a31` text at 1.63:1 contrast (raised to `#74897c`).

Informational: 58 page/width combinations contain interactive elements smaller than 24×24 CSS px before the final touch-target CSS (icon buttons in chat actions; bare inline text links such as "Connect wallet", "View Full Leaderboard"). Coarse-pointer rules now enlarge icon buttons and bare links to ≥ 40px; inline text links inside sentences remain inline per WCAG 2.5.8's inline exception. The rerun after that CSS reports zero overflow/off-screen/a11y failures; the 24px list is informational only.

## Visual spot checks (screenshots in `docs/upgrade/screenshots/phase2/`)
Home was viewed at 1440 and 390 with real live data; Chat/Messages/Profile/Leaderboard/Docs/Game/ModPanel/ModerationLogs were viewed at 1440 and 390 with fixtures. Widths 320/430/1024/1920/2560 are covered by the automated overflow/off-screen/a11y checks, **not** by manual visual review.
