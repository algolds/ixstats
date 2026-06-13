/**
 * NPC sub-router (diplomatic-cultural) — split across files by domain (2026-06-13)
 * and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API
 * path under this sub-router is byte-identical to the former monolith — no call
 * sites change.
 *
 * Domains:
 *  - generation: cultural scenario generation (template + DB persistence + choice tracking)
 *  - responses:  NPC participation responses for individual and bulk exchange invitations
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCulturalNpcGenerationRouter } from "./generation";
import { diplomaticCulturalNpcResponsesRouter } from "./responses";

export const diplomaticCulturalNpcRouter = mergeRouters(
  diplomaticCulturalNpcGenerationRouter,
  diplomaticCulturalNpcResponsesRouter
);
