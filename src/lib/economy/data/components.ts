/**
 * Atomic Economic Components - Combiner
 *
 * Merges partitioned component definitions into a single lookup record.
 *
 * @module atomic-economic-data/components
 */

import { EconomicComponentType, type AtomicEconomicComponent } from "./types";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_1 } from "./components-part1";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_2 } from "./components-part2";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_3 } from "./components-part3";

export const ATOMIC_ECONOMIC_COMPONENTS: Partial<
  Record<EconomicComponentType, AtomicEconomicComponent>
> = {
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_1,
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_2,
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_3,
};
