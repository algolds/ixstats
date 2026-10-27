/**
 * Policy presets (spec §4): the 55 government templates offered inside "Customise institutions"
 * (founding) and the editor's Institutions section. Applying one replaces the whole selection
 * with `getTemplateSelection` in one update.
 */

import type { ComponentType } from "@prisma/client";
import { GOVERNMENT_TEMPLATES, getTemplateSelection } from "./data/templates";

export interface PolicyPreset {
  id: string;
  /** Sentence case, for the picker ("Modern democracy"). */
  name: string;
  description: string;
  components: ComponentType[];
}

/** "Modern Democracy" as "Modern democracy"; acronyms ("EU", "UN") keep their capitals. */
function sentenceCase(text: string): string {
  return text
    .split(" ")
    .map((word, index) => (index === 0 || /^[A-Z0-9]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(" ");
}

/** Every preset, alphabetical by name. */
export const POLICY_PRESETS: readonly PolicyPreset[] = Object.entries(GOVERNMENT_TEMPLATES)
  .map(([id, template]) => ({
    id,
    name: sentenceCase(template.name),
    description: template.description,
    components: getTemplateSelection(id),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function getPolicyPreset(id: string): PolicyPreset | undefined {
  return POLICY_PRESETS.find((preset) => preset.id === id);
}

/**
 * Whether applying `preset` would replace institutions the player chose: they have some, and the
 * preset's set is not the same set.
 */
export function presetReplacesChoices(
  currentChoices: readonly string[],
  preset: readonly string[]
): boolean {
  if (currentChoices.length === 0) return false;
  return !(
    currentChoices.length === preset.length && currentChoices.every((c) => preset.includes(c))
  );
}
