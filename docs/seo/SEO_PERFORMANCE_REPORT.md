# Performance Report

Numbers: `SEO_BASELINE_COMPARISON.md`. Changes made, by site:

| Site | Change | Effect (lab) |
|---|---|---|
| LSC | Self-hosted Inter + JetBrains Mono (latin, variable) replacing render-blocking Google Fonts; 64 px WebP/PNG logo instead of 192 px PNG; no framework, ~20 KB CSS, ES modules; long cache for fonts | Mobile 83 → 95, LCP 4.6 → 2.8 s, CLS 0 |
| LSC | Identity-filtered schedule (1.4 MB → 1.6 KB/lookup); CDN caching (`s-maxage=15` report, `2` clock); polling paused when tab hidden; timeline 72/144 SVG bins | Lower data use and shared upstream load |
| Pump X1 | Skip three.js globe on software WebGL (SwiftShader/llvmpipe/Basic Render), keep existing static fallback | Mobile 56 → 97, TBT 148,860 → 30 ms; GPU devices unchanged |
| X1 Space | Reserve `100svh` for main and the stats grid's loaded height while loading | Mobile CLS 0.286 → 0.015, perf 62 → 79 |
| X1 Nexus / 404X1 | Metadata only (no runtime cost beyond a tiny effect per navigation) | Neutral |

## Targets
| Target | Met? |
|---|---|
| Mobile ≥ 95 | LSC 95, Pump 97 ✅ · Nexus 93 · 404X1 82 · X1 Space 79 ❌ |
| Desktop ≥ 95 | all five ✅ (98–100) |
| Accessibility ≥ 95 | all five 99–100 ✅ |
| SEO 100 | all five ✅ |
| CLS ≤ 0.1 | all five ✅ (lab) |
| LCP ≤ 2.5 s (p75 field) | not measurable here; lab mobile LCP 2.3–4.3 s |

## Remaining bottleneck (X1 Space, 404X1 mobile LCP ≈ 4 s)
Base44 SPA bundle + platform runtime before first content. Safe next steps (not done — require visual/behavioural review): route-level preloading of the Dashboard chunk, deferring chart libraries below the fold, moving the platform analytics script to idle. Field data should be gathered first (Vercel Speed Insights is a dependency in LSC but must be enabled in the dashboard; Search Console CWV report after verification).
