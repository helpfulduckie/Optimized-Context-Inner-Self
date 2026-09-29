# WTG patches

> [!summary]
> The `wtg` branch is XloSky's Optimized Context Inner Self, plus three general changes on their own branches, plus the patches World Time Generator (WTG) needs. With Optimized Context off it behaves as LewdLeah's v1.0.2; with it on, it asks for thoughts through XloSky's task card and leaves the context untouched. WTG bundles `files/` from this branch through patchwork-press, as the `InnerSelf` component in `WTG-Working/package.json`. Everything else about WTG + Inner Self compatibility comes from bundle order.

## Branches

Each branch is the one above it plus its own commits.

- **`main`:** XloSky's `upstream/main`, unchanged.
- **`oc-autocards-passthrough`:** one commit that pauses the embedded Auto-Cards under Optimized Context. With `info.useCacheEfficient` true, its context branch passes the text through and starts no generation, its output branch never captures a story output as a card, and its library-scope cleanup is skipped. Nothing in it is WTG-specific, so it's kept separate as a candidate to offer upstream. The same change is in helpfulduckie/Optimized-Context-Localized-Languages, which has the tests for it.
- **`oc-append-only`:** under Optimized Context, `InnerSelf(hook)` runs the context branch on its own copy and returns the original context plus whatever that branch returns to append, which is nothing. AI Dungeon discards a `// @cache-compatible` tab's whole change unless it is a pure append, so any edit Inner Self made would also cancel WTG's and LoLa's appends in the same bundle.
- **`non-oc-parity`:** with Optimized Context off, the context branch uses LewdLeah's original prompts and her choice between them: FORGET when the brain is full, otherwise ASSIGN below 20,000 characters or CHOICE above. XloSky's condensed 1,960-character set exists to fit a story card and is used only on the card route. XloSky's narration-over-dialogue trigger scoring and self-name thought filter stay on both routes. This branch also holds the Jest suite (`npm test`), which compares the non-OC context with LewdLeah's v1.0.2 byte for byte, using her library vendored at `test/baseline/library.js`.
- **`wtg`:** `non-oc-parity` plus the WTG patches below.

## Versions

**This fork's copy is versioned `<XloSky's version>-wtg.<n>`.** The version appears in `files/package.json`, which patchwork-press prints in WTG's bundle headers, and in `INNER_SELF_OC_BUILD` in `files/library.js`, which prints on the first line of the Configure Inner Self card. Bump `n` whenever any branch here changes what `wtg` bundles. Reset it to `1` on a rebase onto a new XloSky version. If XloSky changes code without changing their version, keep counting `n`.

| Version | XloSky commit | This fork's changes |
|---|---|---|
| `2.8.0-wtg.1` | `0b6808a` (`Ver.2_8_0`) | Auto-Cards paused, append-only guard, non-OC parity with LewdLeah's v1.0.2, WTG patches (card types, no task card stamp, glue) |

## Remotes

- **`upstream`:** XloSky/Optimized-Context-Inner-Self. `main` tracks it unchanged.
- **`leah`:** LewdLeah/Inner-Self, the original v1.0.2. It's a reference for anything OC rewrote.
- **`origin`:** helpfulduckie/Optimized-Context-Inner-Self, this fork.

## The patches

- **Config and control cards are typed `zz_Settings`.** WTG's `excludeCardTypes` skips its system card type, which keeps these cards from getting timestamped. The cards are "Configure Inner Self", "Configure Auto-Cards" and the Auto-Cards enable card. The change is a `const SETTING` near the top of `files/library.js` plus three `type:` lines. WTG's `is.thoughts.test.js` asserts the Configure Inner Self card's type.
- **The task card's Entry carries no build stamp.** XloSky's build started the `🧠 Inner Self Task — do not edit` card's Entry with `// Inner Self <build>`, which reached the model on every task turn. The build now appears only in the card's Notes, and the task card cleanup recognizes this build's card by the `[build <build>]` tag there instead. The card is kept free of WTG timestamps by its title, which WTG lists in `SYSTEM_CARD_TITLES`, rather than by its type, so cards in existing adventures are covered too.
- **Glue calls `InnerSelf(hook)` inside `modifier`.** Patchwork-press wraps each hook tab in a function whose parameter is `text`. InnerSelf's bare `text = …` writes reach the returned text only when the call is lexically inside that wrapper. `files/package.json` is the component manifest patchwork-press reads.

## Bundle order and flag

**Inner Self must be the last source in the WTG + IS merge.** OC's header warns that when two copies of Inner Self share a Library tab, the later one silently wins. `./dependencies/InnerSelf` is listed after WTG's own `src` in both WTG + IS merges.

**The Inner Self dependency and both WTG + IS merges are `cacheCompatible`.** Without the flag, AI Dungeon discards every context change under Optimized Context, WTG's append included.

## Updating from upstream

1. `git fetch upstream`, fast-forward `main` to `upstream/main`, then rebase each branch onto the one above it in order: `oc-autocards-passthrough`, `oc-append-only`, `non-oc-parity`, `wtg`. If upstream has taken a branch's change, drop that branch and rebase the next one onto its parent.
2. **Expect conflicts in `non-oc-parity` whenever XloSky edits the prompt block.** Keep XloSky's card-route changes and keep the non-OC `else` branch assembling LewdLeah's prompts. If the `wtg` rebase conflicts on a `type:` line, reapply `SETTING` to the three card templates: the Inner Self config `template`, `getConfigureCardTemplate` and `getEnableCardTemplate`.
3. Run `npm test` here, then in `WTG-Working`. Here, a failing byte-for-byte test means the non-OC route no longer matches LewdLeah's. In `WTG-Working`, the non-OC assertions in `is.thoughts.test.js` and `sandbox.built.test.js` key on LewdLeah's prompt text ("SUMMARY OF WHAT YOU MUST DO"), and the Optimized Context test keys on the task card's `## 1) THOUGHT-WRITING FORMAT` heading. If upstream rewrites the card's instruction set, update that marker.
4. Set the new version in `files/package.json` and `INNER_SELF_OC_BUILD`, and add a row to the Versions table.
5. Push `oc-autocards-passthrough`, `oc-append-only` and `non-oc-parity` to `origin`, then `git push --force-with-lease origin wtg`.
