/**
 * Combat module (realm time D3): the theatre from the map, engagements built from the defense model, the odds screen,
 * seeded commits and resolutions, force losses, and the cross-realm guard. Routers stay thin and call these.
 */
export { CROSS_REALM_MESSAGE, assertSameRealm, buildEngagement, combatSide, normaliseOrders } from "./combat.engagement";
export type { Engagement, EngagementOrders } from "./combat.engagement";
export { loadTheatre, mapTheatreFacts, resetTheatreCache } from "./combat.theatre";
export { combatOdds, type CombatOdds } from "./combat.odds";
export {
  applyConsequences,
  commitStrike,
  concludePvP,
  newBattleId,
  pvpOrders,
  replayEngagement,
  resultData,
  sealOrders,
  sealPvP,
} from "./combat.commit";
export { applyForceLosses, assetLossShare, personnelAfterLoss } from "./combat.losses";
export { combatSeed, ordersHash } from "./combat.seed";
export { DEFAULT_INTERVENTION_DAYS, resolveIntervention, sealIntervention } from "./combat.operations";
