/**
 * National Issues router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.nationalIssues.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - player:    player-facing inbox (list / view / mark / respond / dismiss), pending count,
 *               history, and per-issue consequences
 *  - templates: admin template CRUD, search, toggle, and preview-with-variable-substitution
 *  - engine:    force-generate, batch seeding, generation stats, splash/discovery feed,
 *               and manual evaluation triggers
 */
import { mergeRouters } from "~/server/api/trpc";
import { nationalIssuesPlayerRouter } from "./player";
import { nationalIssuesTemplatesRouter } from "./templates";
import { nationalIssuesEngineRouter } from "./engine";

export const nationalIssuesRouter = mergeRouters(
  nationalIssuesPlayerRouter,
  nationalIssuesTemplatesRouter,
  nationalIssuesEngineRouter
);
