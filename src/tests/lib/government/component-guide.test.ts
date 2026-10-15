/**
 * Plain categories and effect lines for the government picker (spec §1 Step 3, §5).
 */

import type { ComponentType } from "@prisma/client";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import {
  GOVERNMENT_COMPONENT_EFFECT,
  GOVERNMENT_COMPONENT_GROUP,
  GOVERNMENT_COMPONENT_GROUPS,
  getComponentEffect,
  getComponentGroup,
  groupComponentsByPlainGroup,
} from "~/lib/government/component-guide";

const DEFINED = Object.keys(ATOMIC_COMPONENTS) as ComponentType[];

describe("government component guide", () => {
  it("gives every defined component a plain group and a one-line effect", () => {
    for (const type of DEFINED) {
      expect(GOVERNMENT_COMPONENT_GROUPS).toContain(getComponentGroup(type));
      const effect = getComponentEffect(type);
      expect(effect).toMatch(/^[A-Z][^\n]*\.$/);
      expect(effect).not.toMatch(/[–—]/);
    }
  });

  it("covers only defined components", () => {
    const extra = Object.keys(GOVERNMENT_COMPONENT_EFFECT).filter(
      (type) => !ATOMIC_COMPONENTS[type as ComponentType]
    );
    expect(extra).toEqual([]);
    expect(Object.keys(GOVERNMENT_COMPONENT_GROUP).sort()).toEqual(
      Object.keys(GOVERNMENT_COMPONENT_EFFECT).sort()
    );
  });

  it("uses every group", () => {
    const used = new Set(Object.values(GOVERNMENT_COMPONENT_GROUP));
    expect([...used].sort()).toEqual([...GOVERNMENT_COMPONENT_GROUPS].sort());
  });

  it("buckets components in display order and skips empty groups", () => {
    expect(
      groupComponentsByPlainGroup(["SECURITY_ALLIANCES", "ELECTORAL_LEGITIMACY", "RULE_OF_LAW"])
    ).toEqual([
      { group: "How leaders are chosen", components: ["ELECTORAL_LEGITIMACY"] },
      { group: "Where power sits", components: ["RULE_OF_LAW"] },
      { group: "Foreign relations", components: ["SECURITY_ALLIANCES"] },
    ]);
  });
});
