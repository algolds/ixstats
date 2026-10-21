/**
 * Government policy presets: every template references only defined components, and
 * applying one sets the whole selection (spec §4; the old loop kept only the last pick).
 */

import {
  GOVERNMENT_TEMPLATES,
  getTemplateSelection,
} from "~/lib/government/atomic-data";

const TEMPLATE_IDS = Object.keys(GOVERNMENT_TEMPLATES);

describe("GOVERNMENT_TEMPLATES", () => {
  it("returns the full component set for a template and nothing for an unknown id", () => {
    for (const id of TEMPLATE_IDS) {
      expect(getTemplateSelection(id)).toEqual([...new Set(GOVERNMENT_TEMPLATES[id]!.components)]);
    }
    expect(getTemplateSelection("not-a-template")).toEqual([]);
  });
});
