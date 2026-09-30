import { ComponentType } from "@prisma/client";
import type { AtomicGovernmentComponent } from "./types";
import { ATOMIC_COMPONENTS_PART_1 } from "./components-part1";
import { ATOMIC_COMPONENTS_PART_2 } from "./components-part2";
import { ATOMIC_COMPONENTS_PART_3 } from "./components-part3";

export const ATOMIC_COMPONENTS: Partial<Record<ComponentType, AtomicGovernmentComponent>> = {
  ...ATOMIC_COMPONENTS_PART_1,
  ...ATOMIC_COMPONENTS_PART_2,
  ...ATOMIC_COMPONENTS_PART_3,
};
