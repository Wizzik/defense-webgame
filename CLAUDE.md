@AGENTS.md

# Claude Code notes

The rules above (AGENTS.md) are shared with every AI tool and win over this section. These notes only add what is specific to Claude Code.

## Working with Petr
- Talk to Petr in Czech; code, identifiers, comments, commits and docs stay in English (AGENTS.md).
- Petr plays and tests the game himself: after each block of work, list in `docs/STATUS.md` exactly what he should check in the browser, with ready links (`https://wizzik.github.io/defense-webgame/?debug=1&...`).
- Give a recommendation, not a menu. Ask only when the answer changes what gets built (a number, a rule, a trade-off he must own).

## Workflow
1. Read `docs/STATUS.md`, then only the parts of `ARCHITECTURE.md` and `docs/DECISIONS.md` the task touches.
2. A feature that changes rules: a short plan in `docs/superpowers/plans/` (date-prefixed), then implement in small commits.
3. Before every commit: `npm run check` (skill `finish-task` has the full list).
4. A change of game behaviour on purpose changes the determinism digest: run `npm run sim:digest`, put the new value in `client/determinism/digest.test.ts`, say so in the commit and the PR.
5. Record every new rule or number in `docs/DECISIONS.md` and the outcome in `docs/STATUS.md`.

## Game data without the map (cloud sessions)
- A cloud container has no `data-source/` (the map is never committed), so `npm run data:build` cannot run there.
- Then change `design/*.yaml` **and** the matching rows of `data/generated/*.json` together, by the same rule `tools/data-build` applies (scaling, `levelGrowthExponent`, rounding), with a small script in the scratchpad rather than by eye. Mention it in the commit, so Petr can rerun `data:build` locally and confirm the files do not change.
- Skill `data-change` has the steps.

## Project skills (`.claude/skills/`)
- `finish-task`: checks, docs, commit, push, draft PR.
- `data-change`: change game data (yaml + generated json) safely.
- `balance-check`: autopilot runs before and after a balance change, with a short table.

## Local notes
- `CLAUDE.local.md` (gitignored) is for personal notes that must not reach the public repository.
