import type { GovernmentTemplate } from "~/types/government";
import { Imperial_AdministrationTemplate } from "./imperial-administration";
import { Nordic_Social_DemocracyTemplate } from "./nordic-social-democracy";
import { Singaporean_MeritocracyTemplate } from "./singaporean-meritocracy";
import { Swiss_Federal_ConfederationTemplate } from "./swiss-federal-confederation";
import { Emirati_FederationTemplate } from "./emirati-federation";
import { Japanese_Parliamentary_SystemTemplate } from "./japanese-parliamentary-system";
import { German_Federal_RepublicTemplate } from "./german-federal-republic";
import { Canadian_ConfederationTemplate } from "./canadian-confederation";
import { Brazilian_Federal_RepublicTemplate } from "./brazilian-federal-republic";
import { Indian_Union_GovernmentTemplate } from "./indian-union-government";
import { Australian_CommonwealthTemplate } from "./australian-commonwealth";

export {
  Imperial_AdministrationTemplate,
  Nordic_Social_DemocracyTemplate,
  Singaporean_MeritocracyTemplate,
  Swiss_Federal_ConfederationTemplate,
  Emirati_FederationTemplate,
  Japanese_Parliamentary_SystemTemplate,
  German_Federal_RepublicTemplate,
  Canadian_ConfederationTemplate,
  Brazilian_Federal_RepublicTemplate,
  Indian_Union_GovernmentTemplate,
  Australian_CommonwealthTemplate,
};

export const governmentTemplates: GovernmentTemplate[] = [
  Imperial_AdministrationTemplate,
  Nordic_Social_DemocracyTemplate,
  Singaporean_MeritocracyTemplate,
  Swiss_Federal_ConfederationTemplate,
  Emirati_FederationTemplate,
  Japanese_Parliamentary_SystemTemplate,
  German_Federal_RepublicTemplate,
  Canadian_ConfederationTemplate,
  Brazilian_Federal_RepublicTemplate,
  Indian_Union_GovernmentTemplate,
  Australian_CommonwealthTemplate,
];

export function getGovernmentTemplates(): GovernmentTemplate[] {
  return governmentTemplates;
}

export function getGovernmentTemplate(name: string): GovernmentTemplate | undefined {
  return governmentTemplates.find((template) => template.name === name);
}

export function getGovernmentTemplatesByType(governmentType: string): GovernmentTemplate[] {
  return governmentTemplates.filter((template) => template.governmentType === governmentType);
}

export function getGovernmentTypes(): string[] {
  return Array.from(new Set(governmentTemplates.map((template) => template.governmentType)));
}
