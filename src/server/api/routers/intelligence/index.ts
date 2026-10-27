/**
 * Intelligence router.
 * Templates (admin CRUD) and alerts (the country owner's threshold-alert inbox, MC-17).
 * Feed, briefings, core and analytics had zero callers and were removed (plan 341,
 * 2026-09-25).
 * Public API shape: api.intelligence.*
 */
import { mergeRouters } from "~/server/api/trpc";
import { intelTemplatesRouter } from "./templates";
import { intelAlertsRouter } from "./alerts";

export const intelligenceRouter = mergeRouters(intelTemplatesRouter, intelAlertsRouter);
