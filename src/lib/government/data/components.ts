import { ComponentType } from "@prisma/client";
import type { AtomicGovernmentComponent, AtomicGovernmentComponentDefinition } from "./types";
import { ATOMIC_COMPONENTS_PART_1 } from "./components-part1";
import { ATOMIC_COMPONENTS_PART_2 } from "./components-part2";
import { ATOMIC_COMPONENTS_PART_3 } from "./components-part3";
import { getSynergyPartners } from "../synergy-table";

const DEFINITIONS: Partial<Record<ComponentType, AtomicGovernmentComponentDefinition>> = {
  ...ATOMIC_COMPONENTS_PART_1,
  ...ATOMIC_COMPONENTS_PART_2,
  ...ATOMIC_COMPONENTS_PART_3,
};

/**
 * Every defined government component. `synergies` and `conflicts` come from the shared
 * synergy table (`~/lib/government/synergy-table`), never from the definitions.
 */
export const ATOMIC_COMPONENTS: Partial<Record<ComponentType, AtomicGovernmentComponent>> =
  Object.fromEntries(
    Object.entries(DEFINITIONS).map(([type, definition]) => [
      type,
      { ...definition, ...getSynergyPartners(type as ComponentType) },
    ])
  );
