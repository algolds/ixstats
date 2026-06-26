---
name: feedback_plans_dir
description: "Save planning/design docs to the project's plans/ dir (now git-TRACKED)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ea35cda2-feba-40f2-8d0a-2d9c912b423c
---

When producing a plan or design doc for IxStats, save it to the `plans/` directory at the
project root (`/ixwiki/public/projects/ixstats/plans/`). Number new plans sequentially
(`plans/NNN-kebab-name.md`, e.g. 052); completed/old ones move to `plans/archive/`.

**UPDATE (June 2026):** plans/ is now **git-TRACKED** — the user had me remove the
`/plans/` rule from `.gitignore` and `git add plans/`. Earlier it was intentionally
gitignored; that reversed. So plans are versioned in git history now, not local-only.

**How to apply:** Write the plan to `plans/NNN-<kebab-name>.md`. It is committable — no
gitignore dance needed. Keep the harness plan file in sync as a mirror when in plan mode.
