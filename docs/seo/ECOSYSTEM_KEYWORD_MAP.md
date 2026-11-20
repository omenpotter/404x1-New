# Ecosystem Keyword Map — five X1 sites

**Evidence sources used:** Google autocomplete suggestions (`suggestqueries.google.com`, 2026-11-20, raw list in §5) for real query phrasing; X1 documentation; site source. **No search volumes, difficulty scores or rankings are claimed** — no keyword-volume data source was available. Confidence: **H** = query appears verbatim in autocomplete; **M** = closely related phrasing appears / strong topical fit; **L** = hypothesis to validate in Search Console.

## 1. Ownership principle

| Site | Owns the intent | Must not compete for |
|---|---|---|
| **X1 Space** | X1 explorer, blocks/transactions/validators/tokens/pools *data*, "what is X1" education, verifying tokens, RPC | launching tokens, leader schedules, a specific token's brand |
| **X1 Leader Slot Checker** | leader slots, leader schedule, epoch timing, validator block-production schedule | general explorer, validator lists/rankings |
| **X1 Nexus** | fair launch, token launchpad/creator, graduation, launch liquidity, locks, vesting | explorer queries, token-specific brands |
| **Pump X1** | PUMP token (brand + contract + supply + market) | generic "X1 token launch", "Token-2022" education |
| **404X1** | 404 ERROR token, 404X1 community/chat/game | generic X1 or token education |

## 2. Keyword map

| Cluster / query | Intent | Owner | Primary landing page | Supporting pages | Conf. | Notes / competition observations |
|---|---|---|---|---|---|---|
| x1 blockchain explorer · x1 block explorer · x1 mainnet explorer · x1 explorer | Navigational/transactional | X1 Space | `/` | `/Blocks`, `/Learn` | H | Autocomplete also shows "x1 ecochain explorer", "x1 testnet explorer", unrelated "rover x1 explorer". Official explorer `explorer.mainnet.x1.xyz` exists — X1 Space competes on depth (validators, tokens, pools). |
| x1 blockchain · x1 blockchain mainnet · x1 network crypto · what is X1 blockchain | Informational | X1 Space | `/Learn` | `/NetworkHealth` | H/M | Name collision (EcoChain, BlockDAG X1, Lenovo X1). `/Learn` has an explicit disambiguation section. docs.x1.xyz is the authority; link to it. |
| x1 transactions · x1 transaction explorer · verify x1 transaction | Navigational/how-to | X1 Space | `/Transactions` | `/Learn#transactions` | M | Detail pages are noindex (unbounded). |
| x1 validator · x1 validators · x1 validator explorer | Navigational | X1 Space | `/Validators` | `/Leaderboard`, `/ValidatorDetail?id=` (336 indexed) | H | "x1 validator rewards" → `/StakingCalculator` + `/Learn#validators`. |
| x1 staking · stake XNT · x1 staking calculator | Informational/tool | X1 Space | `/StakingCalculator` | `/Validators` | M | Autocomplete empty for "x1 staking" → low current demand. |
| x1 rpc · x1 mainnet rpc · x1 blockchain rpc | Navigational/dev | X1 Space | `/Learn#rpc` | `/ApiDocs` | H | Official answer is docs.x1.xyz/build-on-x1/resources; X1 Space cites it rather than replacing it. |
| x1 token explorer · SPL token · token-2022 · token-2022 vs spl · verify x1 token | Informational/tool | X1 Space | `/TokenExplorer` | `/Learn#tokens` | H | "token-2022 vs spl", "token 2022 extensions" are real queries; Solana docs dominate — target the X1-specific angle only. |
| x1 liquidity pools · xdex pools · x1 dex | Navigational | X1 Space (data) | `/LPExplorer` | Nexus `/LiquidityPool` (positions) | M | "xdex"/"x1 dex" autocomplete is noisy (unrelated brands). xDEX's own site owns "xDEX". Neither ARKBS site claims to be xDEX. |
| x1 network status · x1 tps | Informational | X1 Space | `/NetworkHealth` | — | M | |
| **x1 leader slot · x1 leader schedule · x1 validator leader slots · x1 slot leader** | Tool | **Leader Slot Checker** | `/` | `/guide` | M | "x1 leader" autocomplete is dominated by unrelated topics; long-tail is the realistic target. |
| solana leader schedule · solana get leader schedule · svm leader schedule | Informational (adjacent) | Leader Slot Checker | `/guide` | `/#faq` | H (Solana) / L (X1) | Solana docs own the Solana query; the guide targets "X1 vs Solana" differences (epoch length, slot time). |
| x1 epoch · x1 epoch length · x1 block production schedule | Informational | Leader Slot Checker | `/guide#epochs` | `/#faq` | M | "x1 epoch" autocomplete exists but mixed. |
| x1 validator monitoring · x1 mainnet validator tools | Tool | Leader Slot Checker | `/` | X1 Space `/Validators` | L | |
| **x1 fair launch · x1 token launch · x1 token launchpad · x1 token creator** | Transactional | **X1 Nexus** | `/` | `/CreateToken`, `/Docs` | L | Autocomplete empty → nascent demand; brand + docs depth is the strategy. |
| token graduation · how token graduation works · fair launch token | Informational | X1 Nexus | `/Docs#graduation` | `/TokenDiscovery` | M | "token graduation" autocomplete is dominated by school graduation gifts — use "token graduation X1 / xDEX" phrasing. Do not claim automated graduation (not live). |
| x1 token discovery · new x1 tokens | Navigational | X1 Nexus | `/TokenDiscovery` | — | L | |
| liquidity lock x1 · token vesting x1 | Tool | X1 Nexus | `/Locks`, `/Vesting` | `/Docs` | L | |
| x1 nexus | Navigational | X1 Nexus | `/` | — | M | Collides with "Nexus X1" mouse/guitar products. |
| **pump x1 · PUMP token X1 · $PUMP X1** | Navigational | **Pump X1** | `/` | `/token/` | H ("pump x1"); noisy | Autocomplete shows water-pump products — brand + mint address disambiguate. |
| PUMP contract address · PUMP supply | Navigational | Pump X1 | `/token/` | `/token/#faq` | M | |
| PUMP price · PUMP XNT | Transactional | Pump X1 | `/market/` | — | M | No price claims in metadata. |
| **404x1 · 404 token X1 · 404 ERROR token** | Navigational | **404X1** | `/` | `/Docs` | M | "404x1" autocomplete is noisy (HTTP error codes). Mint address in llms.txt/JSON-LD for disambiguation. |
| xnt token · xnt token price | Navigational | — (not owned) | — | X1 Space `/Learn` mentions XNT | H | Exchanges/aggregators dominate price queries. Not targeted. |
| solana virtual machine · svm blockchain · solana-compatible blockchain | Informational | X1 Space (context only) | `/Learn#what-is-x1` | LSC `/guide#svm` | H (generic) | Use the official term "Solana Virtual Machine (SVM)". "Solana virtual engine" autocompletes to "solana virtual machine" — user-language variant, **not** used as a term. |

## 3. Internal and cross-site linking (implemented)

| From | To | Anchor / context |
|---|---|---|
| X1 Space `/ValidatorDetail` | Leader Slot Checker `/?validator=<vote>` | "Leader schedule" action button on each validator |
| X1 Space footer, `/Learn` | Leader Slot Checker, X1 Nexus | "Leader schedules", "X1 Nexus launches"; in-text where the guide explains leader slots / launching |
| Leader Slot Checker results | X1 Space `ValidatorDetail`, `BlockDetail?slot=` | Validator profile; each elapsed leader window links to its block |
| X1 Nexus header | X1 Space | "Explorer" (pre-existing; now canonical host) |
| Pump X1 `/token/` FAQ, footer | X1 Space `TokenExplorer?mint=`; X1 Nexus | "Verify PUMP on X1 Space"; "X1 Nexus fair launches" (Pump roadmap references Nexus) |
| 404X1 contract card | X1 Space `TokenExplorer?mint=` | "X1 Space ↗" next to the existing explorer link |

No sitewide exact-match keyword links were added; every cross-link sits where the target answers the user's next question.

## 4. Content requirements / research tasks

- X1 Space `/Learn`: refresh the inflation and rate-limit figures when docs.x1.xyz changes (owner/content task).
- X1 Nexus: once graduation signing is approved and live, update metadata copy (currently describes eligibility, not automation).
- Pump X1: decide whether "Fixed supply 18,446,744,073" should display current on-chain supply (owner content decision).
- Validate L-confidence clusters with Search Console query data after 4–8 weeks of indexing.

## 5. Raw autocomplete evidence (2026-11-20)

See `docs/seo/evidence/autocomplete-2026-11-20.txt` in this repository.
