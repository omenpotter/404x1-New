# Production cleanup plan — test residue

Status: plan only. Nothing below has been executed. All figures were read live from the
production database on the `security-hardening` branch (read-only queries).

## 1. Test accounts from the concurrency run

Two Player records were created by a race-condition test harness. Their wallet strings
(`race_w_a_1794405513015`, `race_w_b_1794405513154`) are not valid Solana or EVM addresses, so
they cannot have passed the signature check in `authWallet`. They were written with privileged
(service-role) access, not through the public login path.

| Record | ID | Key fields |
| --- | --- | --- |
| Player `racea13015` | `6af4748978657add715158e5` | RP 9500, RPx 500, created 2026-11-11T13:58:33.152Z |
| Player `raceb13154` | `6af4748920f460c5bbee69ec` | RP 10, RPx 0, created 2026-11-11T13:58:33.255Z |

## 2. Records that depend on those two accounts

| Record | ID | Dependency |
| --- | --- | --- |
| RpAward (10 RP, reason "race test", 2026-11-11T13:58:56.081Z) | `6af474a0783b986bb01106c9` | references both race players by ID and username |
| RpConversion (500 RP → 500 RPx, rate 1, 2026-11-17T14:11:34.261Z) | `6afc609683d86ab0bf154642` | references `racea13015` by ID and username |
| GameSession (started 2026-11-11T13:56:23.934Z, consumed) | `6af4740844f508086eee70f5` | `player_id` is `probe_player`, an ID that matches no Player record |

## 3. Other test residue found (not part of the race run)

| Record | ID(s) | Note |
| --- | --- | --- |
| RpGrant "test award", 5 RP, to username `new` | `69b0262bcefdf7e5cf506e93` | recipient Player no longer exists; created 2026-03-10 |
| Message by username `123` (3 rows) | `69dd3fdf2f45464d10032fff`, `69dd3fc6219d8021c79aa8d2`, `69dd3fbe161e3f506842e625` | author has no Player record |

## 4. Stress-test moderation logs

262 ModerationLog rows exist. Classification by `target_username`:

- **202 rows** target `*_stress_bot_*` accounts. Batch A below. Their targets do not exist as
  Player records, and no Player record references them.
- **60 rows** are older bot-harness activity (2026-03-07 to 2026-03-10) targeting AI test names
  (`test2`, `HaxorCoin`, `SpamKing`, `scammer_user`, `user3` …). **Six of these target the
  still-existing `test` account**, so these rows are deliberately left out of the plan. They are
  genuine moderation history for a live player and must not be bulk-deleted by a pattern.

Batch A — exact IDs (202):

```
69b00aa4dbefede522ea6da2,69b00aa3f2ed8966eed5ecd7,69b00aa2937d7ac80423daa0,69b00aa157620fcae8ac5267,
69b00aa0c9471104c70fce9a,69b00a9f726704bd742faeca,69b00a9e7ea249aa93d44343,69b00a9deb039d1e2760389b,
69b00a9c823e3c5eb4634741,69b00979fbae5eed5695f475,69b0097827cf9ece280d794f,69b00977c8881a1bb640ae87,
69b009764c40e7a2709f0d69,69b009755a9da5941a012053,69b0097447518eb2515aabfc,69b009738ceb8393140cdae6,
69b00972f2f24eb62741ecae,69b0097191a73c678f75d82d,69b00970c0ad75bed53d3eeb,69b0096f48e469bae90a4c3b,
69b008502ef95af68d723198,69b0084f0baaac784ba4ed90,69b0084e586167d95ef8dba1,69b0084dd2db2bc62e70954e,
69b0084b2a7ba4bf782c28f4,69b0084a13b8be817a716195,69b008498e46fd4b62c9439e,69b008487fc2456e5cbe9ae5,
69b00847c061980c9d0c55fd,69b008462a7ba4bf782c28f3,69b008441a59e8060004f458,69b0084373f882db87adb17e,
69b0072a5e46bfa73e8f854e,69b0072815a14dafe46ad33e,69b007279cbdf1d960267dc0,69b00724f8706e2ab4af051f,
69b007246f1efbf184d83096,69b007231530e67cd2f9a178,69b0071f4d0dc28e2f01806a,69b0071e4e89cdf7bd51a931,
69b0071b24b9b04763cec7c6,69b0071aef8b1d8ef5b6aad3,69b00719982c9e4e95aa8f10,69b00607415daaf3d19b0e3c,
69b006067d07b2cd9705809b,69b0060582c6c5dea4c1dffe,69b0060440dd8b625799801d,69b006031b7611c77d0e3693,
69b006022e316d62a0e7ecc4,69b006014fafe151ebd00470,69b006008e18b22bd3285b48,69b005ffa166976fe4d9f229,
69b005fef2cd51bcce2794be,69b005fd6e238b387bd0d5e4,69b005fc7d9eead6f5a4dd21,69b005fbeedfc33c7ec58cd7,
69b005f944a4beedd18bb51a,69b005f8c82e6295133f854a,69b005f7e5992df50c87cc54,69b005f5d63111f5a34dcc6c,
69b005f5fd78cbfef82ca2ba,69b005f40faef4c97c575fb2,69b005f370c7571639f986e9,69b005f219f693ec0250dcb0,
69b005f17236bbc1d6f219bf,69b005f03c662a8061b05092,69b005ef2f1daccddd5df9bc,69b005ee4fba4045c56e748f,
69b005ed65fea74514166d55,69b005ec81f88c34031f6697,69b005eb4fba4045c56e748b,69b003ad9a4d8c25e4cac789,
69b003a99a4d8c25e4cac788,69b003a39a4d8c25e4cac787,69b002e2faf732d31380f263,69b002e2faf732d31380f262,
69b002e2faf732d31380f261,69b002e2faf732d31380f260,69b002e2faf732d31380f25f,69b00293faf732d31380f25e,
69b00293faf732d31380f25d,69b00293faf732d31380f25c,69b00293faf732d31380f25b,69b00293faf732d31380f25a,
69b00293faf732d31380f259,69b00293faf732d31380f258,69b00293faf732d31380f257,69b00293faf732d31380f256,
69b00293faf732d31380f255,69b00293faf732d31380f254,69b00293faf732d31380f253,69b00293faf732d31380f252,
69b00293faf732d31380f251,69b00293faf732d31380f250,69b0002a0f4facda4fa793b2,69b000270f4facda4fa793af,
69b000230f4facda4fa793ad,69b000200f4facda4fa793ac,69b0001d0f4facda4fa793ab,69b000190f4facda4fa793aa,
69affdcea04fe36445957b61,69affcc81dfff88c428e3611,69affcc64ea591a85887bee5,69affcc53061a45a1badb4fe,
69affcc489afc70654a8df6e,69affcc3dc1916622e24684a,69affcc2abfddd64c4562ef9,69affcc17f5b85aec941607b,
69affcc0f440bbcdf6bfc991,69affcbffbff12ff69e1e375,69affcbe5c01761f437c1863,69affcbd7073f72448259cbe,
69affcbc5927a75e97872ec1,69affcbb6d36a9c83c233988,69affcbaa790cfab98af4cdf,69affcb8f62dcd62df5c496d,
69affcb792cb3b4de267a369,69affcb675bc8758a4418264,69affcb5d770c0739ab0188d,69affcb496807a0fe649b8a6,
69affcb40dc6baa910c94647,69affc78c1089dbe035d6260,69affc7774baef1ac7b359b5,69affc77bae1a29e7edfc48a,
69affc76426388d3da51b982,69affc6fd847f53e3d97c35c,69affc6fae2dd5adab80801f,69affc6efa3b3b5072c2c152,
69affc6dfa3b3b5072c2c151,69affc6df39498eb75ac4505,69affc6ca0b6ff746960fd4f,69affc6b80b0ade9eae926e8,
69affc6b92e17f18f5eff7ed,69affc6af4e1d06d376e5b4e,69affc6af4f20930d396e589,69affc69d01bcc2d274a6e73,
69affc681ca5d90bc5e42d00,69affc68abfddd64c4562ee3,69affc671ca5d90bc5e42cff,69affc6662d52674be45d83b,
69affc65cfd8bb3289fc7bf8,69affc65a790cfab98af4ccc,69affc64bae1a29e7edfc485,69affc63b0d3d8c13bcc8e8c,
69affc621a9a3e8dd6f85e31,69affc6268becaf3a8797ed0,69affc61a5eb909d99d63a74,69affc5fe629c59323a1cdad,
69affc5fdc1916622e246832,69affc5eb1f67cd9dbe83c55,69affc5d5374aa630067d8bc,69affc5c426388d3da51b979,
69affc5ccfd8bb3289fc7bf6,69affc5bf4e1d06d376e5b4b,69affc5be629c59323a1cda9,69affc5a5c925296769976f1,
69affc5989afc70654a8df4c,69affc5854d04e8a09a449f7,69affc56d01bcc2d274a6e6c,69affc5501e2a9b89564b298,
69affc541c661c5ffbf4c46a,69affc54815cff3491d0a3c4,69affc534f413fd56785e5c5,69affc52d8054b6ea29531c7,
69affc52db31e1a832a6f523,69affc5190d9fa1e9af15d28,69affc51d4af366406c0861e,69affc4fb385a343316ae521,
69affc4f0dc6baa910c94627,69affc4eca71cfcde09657c0,69affc4e0a41e7525a7da830,69affc4d7c2ecef53226b2ff,
69affc4c25e015bb1176dfad,69affc4cc30375ad553bcc56,69affc4bd8054b6ea29531c3,69affc4aa4e91bdd72a33f71,
69affb957773a410630f510a,69affa89acc866dc19560299,69affa89acc866dc19560298,69affa89acc866dc19560297,
69affa89acc866dc19560296,69affa89acc866dc19560295,69affa89acc866dc19560294,69affa89acc866dc19560293,
69affa89acc866dc19560292,69affa89acc866dc19560291,69affa89acc866dc19560290,69affa89acc866dc1956028f,
69affa89acc866dc1956028e,69affa89acc866dc1956028d,69aff9eec9e0fe4b979506a8,69aff9eec9e0fe4b979506a7,
69aff9eec9e0fe4b979506a6,69aff9eec9e0fe4b979506a5,69aff9eec9e0fe4b979506a4,69aff9eec9e0fe4b979506a3,
69aff9eec9e0fe4b979506a2,69aff9eec9e0fe4b979506a1,69aff9eec9e0fe4b979506a0,69aff9eec9e0fe4b9795069f,
69aff9405927a75e97872d8f,69aff9385927a75e97872d8d
```

Re-derivable with a filter on `target_username` `$regex: stress_bot` (202 rows expected).

## 5. Records that must not be touched

Six legitimate players:

| Username | ID | Role |
| --- | --- | --- |
| 404x1 | `698af6600e385fe46699ff1d` | superuser |
| Rich | `69d3bcd79483e0675ddc4f60` | member |
| Silver | `69dfad0daa270be27433468b` | member |
| test | `69e10e80dae3a747773ea0d2` | member |
| pro | `69e34851ed12edecca7dcb33` | member |
| user | `69e34a6fc1b0550aaa91c09d` | member |

Also untouched: the 60 ModerationLog rows outside batch A (including the six targeting the live
`test` account), the RpGrant `69b08d610e34c571fadceb38` (real daily staff reward), all 18
Messages by live accounts, all Reactions, and all 3 Conversations.

Cross-reference check performed: no Conversation, PrivateMessage, Reaction, Message, Score,
RpSpend, RpGrant or ModerationLog row references `6af4748978657add715158e5` or
`6af4748920f460c5bbee69ec`.

## 6. Execution order (when approved)

1. Delete RpAward `6af474a0783b986bb01106c9`.
2. Delete RpConversion `6afc609683d86ab0bf154642`.
3. Delete GameSession `6af4740844f508086eee70f5`.
4. Delete Player `raceb13154` (`6af4748920f460c5bbee69ec`), then Player `racea13015`
   (`6af4748978657add715158e5`).
5. Delete batch A (202 ModerationLog rows) by explicit ID, never by pattern.
6. Optional, separate decision: RpGrant `69b0262bcefdf7e5cf506e93` and the three `123` messages.

After each step, re-run the counts: Player 8 → 6, RpAward 1 → 0, RpConversion 1 → 0,
GameSession 1 → 0, ModerationLog 262 → 60, RpGrant 2 → 1.

## 7. Reversal

Deletes are not reversible through the app. Before executing, export each row as JSON with the
platform's data export for the affected entities (Player, RpAward, RpConversion, GameSession,
ModerationLog, RpGrant, Message) and store it outside the app, so the export is the restore point.
