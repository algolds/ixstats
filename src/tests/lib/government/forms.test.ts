/**
 * Government forms catalogue (spec §4).
 */
import {
  GOVERNMENT_FORMS,
  matchGovernmentForm,
  type GovernmentFormId,
} from "~/lib/government/forms";
import { findSynergyPair } from "~/lib/government/synergy-table";

describe("GOVERNMENT_FORMS", () => {
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
});
