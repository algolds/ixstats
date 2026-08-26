import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";
import { power_distribution_mapping } from "./power-distribution";
import { institutions_control_mapping } from "./institutions-control";
import { economic_governance_mapping } from "./economic-governance";
import { administrative_efficiency_mapping } from "./administrative-efficiency";
import { social_policy_mapping } from "./social-policy";
import { international_relations_mapping } from "./international-relations";
import { innovation_development_mapping } from "./innovation-development";
import { crisis_governance_mapping } from "./crisis-governance";

export * from "./types";

export const ATOMIC_TO_GOVERNMENT_MAPPING: Partial<Record<ComponentType, AtomicGovernmentMapping>> = {
  ...power_distribution_mapping,
  ...institutions_control_mapping,
  ...economic_governance_mapping,
  ...administrative_efficiency_mapping,
  ...social_policy_mapping,
  ...international_relations_mapping,
  ...innovation_development_mapping,
  ...crisis_governance_mapping,
};
