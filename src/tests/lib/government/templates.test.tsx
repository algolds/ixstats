/**
 * Government policy presets: every template references only defined components, and
 * applying one sets the whole selection (spec §4; the old loop kept only the last pick).
 */

import {
  ATOMIC_COMPONENTS,
  GOVERNMENT_TEMPLATES,
  getTemplateSelection,
} from "~/lib/government/atomic-data";

const TEMPLATE_IDS = Object.keys(GOVERNMENT_TEMPLATES);

describe("GOVERNMENT_TEMPLATES", () => {
  it("references only defined components", () => {
    const ghosts = Object.entries(GOVERNMENT_TEMPLATES).flatMap(([id, template]) =>
      template.components.filter((type) => !ATOMIC_COMPONENTS[type]).map((type) => `${id}:${type}`)
    );
    expect(ghosts).toEqual([]);
  });

  it("defines the components templates used to reference without a definition", () => {
    expect(ATOMIC_COMPONENTS.PLANNED_ECONOMY).toBeDefined();
    expect(ATOMIC_COMPONENTS.INSTITUTIONAL_LEGITIMACY).toBeDefined();
  });

  it("returns the full component set for a template and nothing for an unknown id", () => {
    for (const id of TEMPLATE_IDS) {
      expect(getTemplateSelection(id)).toEqual([...new Set(GOVERNMENT_TEMPLATES[id]!.components)]);
    }
    expect(getTemplateSelection("not-a-template")).toEqual([]);
  });
});
