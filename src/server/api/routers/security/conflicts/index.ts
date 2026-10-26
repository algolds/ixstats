/**
 * Security Conflicts Router (Plan 163 / Plan 191), split by domain and recombined here.
 *
 * Handles PvP and PvNPC conflict proposals, mutual responses, active engagements, and battle
 * resolution mechanics. mergeRouters keeps every procedure at the top level, so `api.security.*`
 * is unchanged.
 *
 * Domains:
 *  - pvp:     propose, respond to, withdraw and conclude a PvP challenge
 *  - strikes: conflict reads, target lists, PvNPC strikes, combat odds and declared terrain
 */
import { mergeRouters } from "~/server/api/trpc";
import { securityPvPConflictsRouter } from "./pvp";
import { securityConflictReadsRouter } from "./strikes";

export const securityConflictsRouter = mergeRouters(
  securityPvPConflictsRouter,
  securityConflictReadsRouter
);
