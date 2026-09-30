import type { GovernmentTemplate } from "~/types/government";
import archetypesData from "./archetypes.json";

export const governmentTemplates: GovernmentTemplate[] =
  archetypesData as unknown as GovernmentTemplate[];

export const Imperial_AdministrationTemplate: GovernmentTemplate = governmentTemplates[0]!;
export const Nordic_Social_DemocracyTemplate: GovernmentTemplate = governmentTemplates[1]!;
export const Singaporean_MeritocracyTemplate: GovernmentTemplate = governmentTemplates[2]!;
export const Swiss_Federal_ConfederationTemplate: GovernmentTemplate = governmentTemplates[3]!;
export const Emirati_FederationTemplate: GovernmentTemplate = governmentTemplates[4]!;
export const Japanese_Parliamentary_SystemTemplate: GovernmentTemplate = governmentTemplates[5]!;
export const German_Federal_RepublicTemplate: GovernmentTemplate = governmentTemplates[6]!;
export const Canadian_ConfederationTemplate: GovernmentTemplate = governmentTemplates[7]!;
export const Brazilian_Federal_RepublicTemplate: GovernmentTemplate = governmentTemplates[8]!;
export const Indian_Union_GovernmentTemplate: GovernmentTemplate = governmentTemplates[9]!;
export const Australian_CommonwealthTemplate: GovernmentTemplate = governmentTemplates[10]!;

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
