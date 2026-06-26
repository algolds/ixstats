---
name: feedback_no_typechecks
description: User prefers Claude not run typecheck commands during work sessions
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02b0f25a-7489-49db-a719-d20d48a58795
---

The user does not want me to run typecheck commands (`bun run typecheck:ui`, `typecheck:server`, etc.) during work. When asked to validate changes, rely on careful editing and `bun run lint` if needed, but do not invoke the typecheck scripts — the user runs those themselves.

**Why:** The split typechecks are slow/memory-heavy on this 8GB server and the user would rather control when they run. (Global `tsc --noEmit` is already forbidden per CLAUDE.md — this extends to the split commands during active work.)

**How to apply:** After code edits, summarize what changed and let the user typecheck. Don't block progress waiting on typecheck output. Related: [[critical-constraints]] in MEMORY.md.