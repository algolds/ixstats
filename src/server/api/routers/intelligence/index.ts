/**
 * Intelligence router — domain-split into subdirs and recombined here via mergeRouters.
 * Preserves the exact public API shape:
 * - api.intelligence.*
 * - api.intelligenceBriefing.*
 */
import { mergeRouters } from "~/server/api/trpc";
import { intelFeedRouter } from "./feed";
import { intelTemplatesRouter } from "./templates";
import { intelligenceBriefingRouter } from "./briefings";

export const intelligenceRouter = mergeRouters(intelFeedRouter, intelTemplatesRouter);
export { intelligenceBriefingRouter };
