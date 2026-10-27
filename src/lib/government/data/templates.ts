import type { ComponentType } from "@prisma/client";
import rawTemplates from "./templates.json";

/**
 * Government Template Presets
 */
export const GOVERNMENT_TEMPLATES: Record<
  string,
  {
    name: string;
    description: string;
    components: readonly ComponentType[];
  }
> = rawTemplates as unknown as Record<
  string,
  {
    name: string;
    description: string;
    components: readonly ComponentType[];
  }
>;

/**
 * The full component selection a template applies, in template order and without
 * duplicates. Apply it with one `setSelection` call: selecting components one by one from a
 * stale selection keeps only the last pick. Returns an empty list for an unknown template.
 */
export function getTemplateSelection(templateId: string): ComponentType[] {
  const template = GOVERNMENT_TEMPLATES[templateId];
  return template ? Array.from(new Set(template.components)) : [];
}
