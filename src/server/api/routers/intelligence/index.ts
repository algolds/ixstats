/**
 * Intelligence router.
 * Only the templates sub-router remains: feed, briefings, core, alerts and
 * analytics had zero callers and were removed (plan 341, 2026-09-25).
 * Public API shape: api.intelligence.*
 */
import { intelTemplatesRouter } from "./templates";

export const intelligenceRouter = intelTemplatesRouter;
