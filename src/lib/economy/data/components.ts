/**
 * Atomic Economic Components - Combiner
 *
 * Merges partitioned component definitions into a single lookup record. Every
 * EconomicComponentType has a definition (asserted in src/tests/lib/economy).
 *
 * @module atomic-economic-data/components
 */

import { EconomicComponentType, type AtomicEconomicComponent } from "./types";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_1 } from "./components-part1";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_2 } from "./components-part2";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_3 } from "./components-part3";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_4 } from "./components-part4";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_5 } from "./components-part5";
import { ATOMIC_ECONOMIC_COMPONENTS_PART_6 } from "./components-part6";

export const ATOMIC_ECONOMIC_COMPONENTS: Partial<
  Record<EconomicComponentType, AtomicEconomicComponent>
> = {
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_1,
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_2,
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_3,
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_4,
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_5,
  ...ATOMIC_ECONOMIC_COMPONENTS_PART_6,
};
