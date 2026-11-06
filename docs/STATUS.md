# Status

Updated 2026-11-06. Read this first when you resume work.

## Now

- **Phase 0 (foundation): done.** PR #1 was merged to `main` (2e21bd7) on 2026-11-04. Petr accepted it: on his laptop the spike holds 60 fps on average with 150 and 600 enemies, with a 1% low of 57–59 fps on both WebGPU and WebGL2.
- **Phase 1 (vertical slice): the plan waits for Petr's review.** Plan: `docs/superpowers/plans/2026-11-04-phase-1-vertical-slice.md` on branch `phase-1`. Petr chose subagent-driven execution, task by task.

## Next

1. Petr reviews the phase 1 plan, starting with the table "Co plán rozhoduje".
2. Run Tasks 1–12 with subagent-driven development. Push after every reviewed task and open a draft PR after Task 1. Merging needs Petr.
3. After the plan is approved, propose the second skill (project development rules).

## Open questions for Petr

- Branch previews (Cloudflare Pages, spec §4) need his Cloudflare account. Until then the game is played from `main` after a merge.
- Branch protection for `main` is a GitHub setting he controls.

## Environment notes (cloud container)

- `gh` GraphQL does not work here; use the REST API (`gh api`), for example `gh api -X POST repos/Wizzik/defense-webgame/pulls ...`.
- The shell cannot reach github.io or Actions artifact storage. Check the live site with WebFetch.
- The map export is in `data-source/v20.75/out/` (untracked). If it is missing, run `npm run map:extract -- <map.w3x> v20.75`; the map is a file in the claude.ai project.
- Playwright uses the pre-installed Chromium (`/opt/pw-browsers/chromium-1243`), so `@playwright/test` stays at 1.63.0.
- Commits use Petr's git identity (see `git log`) plus the session's co-author trailers.

## Resume after a break

Read this file, then the task you are on in the current plan, then `git log --oneline -15`. During execution the SDD ledger at `.superpowers/sdd/<plan>/progress.md` lists the finished tasks; trust it and git over memory.
