import {
  EDITOR_IDENTITY_KEYS,
  IDENTITY_FIELDS,
  IDENTITY_SECTION_IDS,
  type EditorSectionId,
  type IdentitySectionId,
} from "~/lib/mycountry/editor-fields";
import type { EditorState } from "./editor-context";
import type { GovernmentFormState } from "./GovernmentFormSection";

/** The government form as the page shows it: the structure's type, else the country's. */
export function governmentFormOf(state: EditorState): GovernmentFormState {
  const government = state.governmentStructure;
  return {
    governmentType: government?.governmentType ?? state.governmentType ?? null,
    headOfState: government?.headOfState ?? null,
    headOfGovernment: government?.headOfGovernment ?? null,
    legislatureName: government?.legislatureName ?? null,
    executiveName: government?.executiveName ?? null,
    judicialName: government?.judicialName ?? null,
  };
}

/** The identity values one section edits, in field order. */
export function identityValuesOf(state: EditorState, section: IdentitySectionId) {
  return IDENTITY_FIELDS[section].map((f) => state.nationalIdentity?.[f.key] ?? null);
}

const isIdentitySection = (section: EditorSectionId): section is IdentitySectionId =>
  (IDENTITY_SECTION_IDS as readonly string[]).includes(section);

/**
 * `target` with one section's values taken from `source`: what Reload does for a section in
 * conflict, leaving every other section's values (and so its unsaved edits) alone.
 */
export function withSection(
  section: EditorSectionId,
  target: EditorState,
  source: EditorState
): EditorState {
  if (isIdentitySection(section)) {
    const keys = IDENTITY_FIELDS[section].map((f) => f.key);
    const identity: Record<string, string | null> = Object.fromEntries(
      EDITOR_IDENTITY_KEYS.map((key) => [key, null])
    );
    Object.assign(identity, target.nationalIdentity);
    for (const key of keys) identity[key] = source.nationalIdentity?.[key] ?? null;
    return {
      ...target,
      ...(section === "symbols" && { flag: source.flag, coatOfArms: source.coatOfArms }),
      nationalIdentity: identity as EditorState["nationalIdentity"],
    };
  }
  switch (section) {
    case "name":
      return { ...target, name: source.name, slug: source.slug };
    case "form":
      return {
        ...target,
        governmentType: source.governmentType,
        // Effectiveness belongs to Institutions; only the type and names come across.
        governmentStructure: source.governmentStructure
          ? {
              ...source.governmentStructure,
              governmentEffectiveness:
                target.governmentStructure?.governmentEffectiveness ??
                source.governmentStructure.governmentEffectiveness,
            }
          : target.governmentStructure,
      };
    case "institutions":
      return {
        ...target,
        governmentComponents: source.governmentComponents,
        governmentStructure: target.governmentStructure && {
          ...target.governmentStructure,
          governmentEffectiveness: source.governmentStructure?.governmentEffectiveness ?? null,
        },
      };
    case "population":
      return {
        ...target,
        baselinePopulation: source.baselinePopulation,
        baselineGdpPerCapita: source.baselineGdpPerCapita,
        currentPopulation: source.currentPopulation,
        currentGdpPerCapita: source.currentGdpPerCapita,
      };
    default:
      return target;
  }
}
