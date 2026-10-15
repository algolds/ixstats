/**
 * Government forms catalogue (spec §4).
 */

import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import {
  GOVERNMENT_FORMS,
  getGovernmentForm,
  matchGovernmentForm,
  type GovernmentFormId,
} from "~/lib/government/forms";
import { findSynergyPair } from "~/lib/government/synergy-table";

describe("GOVERNMENT_FORMS", () => {
  it("has exactly the agreed ids, in order", () => {
    expect(GOVERNMENT_FORMS.map((form) => form.id)).toEqual([
      "parliamentary-republic",
      "presidential-republic",
      "federal-republic",
      "constitutional-monarchy",
      "absolute-monarchy",
      "one-party-state",
      "military-government",
      "theocracy",
      "technocracy",
      "merchant-oligarchy",
      "confederation",
    ]);
  });

  it.each(GOVERNMENT_FORMS.map((form) => [form.id, form] as const))(
    "%s is complete and uses only defined components",
    (_id, form) => {
      expect(form.name).toBeTruthy();
      expect(form.governmentType).toBeTruthy();
      expect(form.description).toMatch(/^[A-Z][^\n]*\.$/);
      expect(form.description).not.toMatch(/[–—]/);
      for (const value of Object.values(form.institutions)) expect(value).toBeTruthy();
      expect(form.components.length).toBeGreaterThan(0);
      expect(new Set(form.components).size).toBe(form.components.length);
      expect(form.components.filter((type) => !ATOMIC_COMPONENTS[type])).toEqual([]);
    }
  );

  it.each(GOVERNMENT_FORMS.map((form) => [form.id, form] as const))(
    "%s starts with no conflicting pair",
    (_id, form) => {
      const conflicts: string[] = [];
      form.components.forEach((a, i) => {
        form.components.slice(i + 1).forEach((b) => {
          if (findSynergyPair(a, b)?.type === "CONFLICTING") conflicts.push(`${a}+${b}`);
        });
      });
      expect(conflicts).toEqual([]);
    }
  );

  it("looks forms up by id", () => {
    expect(getGovernmentForm("theocracy")?.name).toBe("Theocracy");
    expect(getGovernmentForm("not-a-form")).toBeUndefined();
  });
});

describe("matchGovernmentForm", () => {
  it.each<[string, GovernmentFormId]>([
    ["Unitary parliamentary constitutional monarchy", "constitutional-monarchy"],
    ["Federal presidential republic", "federal-republic"],
    ["Absolute monarchy", "absolute-monarchy"],
    ["One-party socialist state", "one-party-state"],
    ["Military junta", "military-government"],
    ["Islamic theocracy", "theocracy"],
    ["Unitary presidential republic", "presidential-republic"],
    ["Unitary parliamentary republic", "parliamentary-republic"],
    ["Federal parliamentary constitutional monarchy", "constitutional-monarchy"],
    ["Swiss-style confederation", "confederation"],
    ["Technocracy", "technocracy"],
    ["Merchant republic ruled by an oligarchy", "merchant-oligarchy"],
    ["Unitary absolute sultanate", "absolute-monarchy"],
    ["Parliamentary constitutional emirate", "constitutional-monarchy"],
  ])("maps %p to %p", (text, expected) => {
    expect(matchGovernmentForm(text)).toBe(expected);
  });

  it("defaults to a parliamentary republic", () => {
    expect(matchGovernmentForm("")).toBe("parliamentary-republic");
    expect(matchGovernmentForm("Unitary Quaternalist something")).toBe("parliamentary-republic");
  });
});
