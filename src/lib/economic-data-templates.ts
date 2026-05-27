// src/lib/economic-data-templates.ts
// ═══════════════════════════════════════════════════════════════════════════
// DEPRECATED — Use ~/lib/economy-factory.ts instead.
// This file is kept for backward compatibility. It re-exports from factory.
// ═══════════════════════════════════════════════════════════════════════════

export { createEmptyEconomyData, createEconomyPreset } from "~/lib/economy-factory";
export type { EconomyPresetTier } from "~/lib/economy-factory";

/**
 * @deprecated Use createEconomyPreset("developed") from ~/lib/economy-factory
 */
import { createEconomyPreset } from "~/lib/economy-factory";
import type { Economy } from "~/schemas/economics.schema";

export const developedEconomyTemplate: Economy = createEconomyPreset("developed");
