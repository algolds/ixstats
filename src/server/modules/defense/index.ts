/**
 * Defense module (realm time D2a): persistence and loading for the defense model in `~/lib/military/model`.
 * Routers stay thin and call these.
 */
export {
  syncDefense,
  ensureStarterForce,
  nationalCombatPower,
  assetTypeForCategory,
  withTx,
  type DefenseDb,
} from "./defense.sync";
export type { DefenseSnapshot } from "./defense.sync";
export { loadEconomy, loadDefenseBudget, realmMedianGdpPerCapita, frontierYearAt } from "./defense.economy";
export {
  setDefenseShares,
  setManpowerModel,
  setDoctrine,
  setAlertLevel,
  setOmPriority,
  setSurge,
  setBranchAllocation,
} from "./defense.policy";
export {
  orderProcurement,
  cancelProcurementOrder,
  listProcurementOrders,
  MAX_OPEN_ORDERS,
  MAX_ORDER_QUANTITY,
} from "./defense.procurement";
export { mobiliseReserves, demobiliseReserves } from "./defense.mobilisation";
export { applyOperationReadiness, type OperationReadinessChange } from "./defense.operations";
export { defenseOverview, publicDefenseOverview, branchDetail, type DefenseOverview } from "./defense.views";
export { threatPictureFor } from "./defense.threat-picture";
export { previewStarterForce, createEmptyBranch, deleteBranch, seedStarterBranches } from "./defense.starter";
export { scrapAsset } from "./defense.assets";
