---
name: feedback_versioning_check
description: "After any major session/change, reference the Versioning & Release Architecture and ask whether to bump a version"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5f677839-8852-409e-9c70-c54e79d85af5
---

After any major session or change, **reference `revision.md`** (the Versioning & Release Architecture) and **ask the user whether any version should change** — the platform `Major.Minor.Patch`, a component's single capability integer, the channel, or the release name — and whether the Version Registry (`src/lib/buildVersion.ts`), `CHANGELOG.md`, or docs need updating.

**Why:** versioning here is a deliberate communication tool (OS-inspired epochs, permanent release names, single source of truth in the registry). The user wants version bumps to be an explicit decision, not silently skipped or guessed at.

**How to apply:** at the end of a substantive task, surface a short prompt — which component(s) changed, whether the change is a user-noticeable capability leap (→ bump that component's integer) vs a fix (→ rides the platform patch + build id), and confirm before editing the registry. Don't bump versions unilaterally; propose and ask. See [[project_versioning_architecture]].
