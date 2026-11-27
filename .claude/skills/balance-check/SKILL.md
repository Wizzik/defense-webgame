---
name: balance-check
description: Use before and after a balance change (enemy strength, hero or spell numbers, items) to measure its effect with autopilot runs.
---

# Balance check

1. Before the change, on a clean tree: `npm run sim:run -- --hero all --seeds 1-20 --gear mid --quiet > <scratchpad>/before.txt` (add `--world N --difficulty X` if the change targets a course; `--idle` for a player who does nothing).
2. After the change: the same command into `after.txt`.
3. Compare wins, boss kill times, losses per two minutes and the `burst` lines per hero; put a short table (hero, wins before → after) into the reply and into `docs/DECISIONS.md` next to the rule.
4. The autopilot is weaker than Petr: a solo human who loses every run while the autopilot wins half means the problem is a rule the autopilot plays around (for example enemies ignoring a far hero), not raw numbers.
