# WTG patches

> [!summary]
> The `wtg` branch is XloSky's Optimized Context Inner Self plus two commits that World Time Generator (WTG) needs. WTG bundles `files/` from this branch through patchwork-press, as the `InnerSelf` component in `WTG-Working/package.json`. Everything else about WTG + Inner Self compatibility comes from bundle order.

## Remotes

- **`upstream`:** XloSky/Optimized-Context-Inner-Self. `main` tracks it unchanged.
- **`leah`:** LewdLeah/Inner-Self, the original v1.0.2. It's a reference for anything OC rewrote.
- **`origin`:** helpfulduckie/Optimized-Context-Inner-Self, this fork.

## The patches

- **Config and control cards are typed `zz_Settings`.** WTG's `excludeCardTypes` skips its system card type, which keeps these cards from getting timestamped. The cards are "Configure Inner Self", "Configure Auto-Cards" and the Auto-Cards enable card. The change is a `const SETTING` near the top of `files/library.js` plus three `type:` lines. WTG's `is.thoughts.test.js` asserts the Configure Inner Self card's type.
- **Glue calls `InnerSelf(hook)` inside `modifier`.** Patchwork-press wraps each hook tab in a function whose parameter is `text`. InnerSelf's bare `text = …` writes reach the returned text only when the call is lexically inside that wrapper. `files/package.json` is the component manifest patchwork-press reads.

## Bundle order

**Inner Self must be the last source in the WTG + IS merge.** OC's header warns that when two copies of Inner Self share a Library tab, the later one silently wins. `./dependencies/InnerSelf` is listed after WTG's own `src` in both WTG + IS merges.

## Updating from upstream

1. `git fetch upstream` and `git rebase upstream/main` on `wtg`.
2. If a rebase conflicts on a `type:` line, reapply `SETTING` to the three card templates: the Inner Self config `template`, `getConfigureCardTemplate` and `getEnableCardTemplate`.
3. Run `npm test` in `WTG-Working`. The IS assertions in `is.thoughts.test.js` and `smoke.built.test.js` key on the instruction-set headings `## 1) THOUGHT-WRITING FORMAT` and `## SHARED RULES`. If upstream rewrites the prompt again, update those markers.
4. `git push --force-with-lease origin wtg`.
