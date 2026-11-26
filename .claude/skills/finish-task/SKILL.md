---
name: finish-task
description: Use when a block of work on Defense Webgame is done and must be verified, documented, committed, pushed and opened as a draft PR.
---

# Finish a task

Run every step; report failures with their output instead of skipping them.

1. `npm run check` (typecheck, vitest, python tests). Fix until green.
2. If game behaviour changed on purpose: `npm run sim:digest`, put the value into `client/determinism/digest.test.ts`, rerun the digest test.
3. If the client changed visibly: `npm run build`, then `npx playwright test --project=webgl2-fallback --trace off` for the specs the change touches (all of them before a PR). `npm run shots` when the look changed; look at the shots yourself.
4. Clean-room check: `git diff --cached --name-only` has no `data-source/`, `xhero/`, `*.w3x`, `war3map.*`; no map names in `client/`, `sim/`, `data/generated/`.
5. Docs: new rules and numbers into `docs/DECISIONS.md` (the section of the feature), the outcome and **what Petr checks** (with links `https://wizzik.github.io/defense-webgame/?debug=1&...`) at the top of `docs/STATUS.md`.
6. Commit in Conventional Commits (`feat(sim): ...`, `fix(client): ...`, `docs: ...`), one role per commit.
7. Push to the session branch, open a **draft** PR (body: what, why, digest change, what Petr checks), subscribe to its activity.
8. Tell Petr in Czech: what changed, what he should try, what is open.
