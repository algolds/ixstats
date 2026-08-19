/**
 * src/lib/economy/index.ts — Master barrel export for Economic & Tax simulation.
 */

export type { ValidationResult } from "./tax-builder-validation";
export * from "./atomic-data";
export * from "./atomic-integration";
export * from "./atomic-integration.server";
export * from "./atomic-utils";
export * from "./atomic-tax-integration";
export * from "./unified-atomic-tax-integration";
export * from "./calculation-groups";
export * from "./modeling-engine";
export * from "./data-mapper";
export * from "./factory";
export * from "./fiscal-calculations";
export * from "./historical-transformers";
export * from "./tax-builder-validation";
export * from "./tax-calculator";
export * from "./tax-data-parser";
export * from "./tax-suggestions-engine";
export * from "./budget-vault-calculator";
export * from "./trade-expiry-cron";
export * from "./passive-income-distribution-cron";
export * from "./auction-completion-cron";
export * from "./auction-service";
export * from "./transport-costs";
export * from "./transport-generator";
export * from "./resource-generator";
export * from "./calculations";
