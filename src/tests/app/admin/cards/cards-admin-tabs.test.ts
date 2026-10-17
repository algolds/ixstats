/** @jest-environment node */
import { CARDS_ADMIN_TABS, cardsAdminTabFromParam } from "~/app/admin/cards/cards-admin-tabs";

describe("cards admin tabs", () => {
  it("has the nine flat tabs, in order", () => {
    expect(CARDS_ADMIN_TABS.map((tab) => tab.label)).toEqual([
      "Overview",
      "Library",
      "Imports",
      "Curation",
      "Packs",
      "Economy",
      "Seasons",
      "Compliance",
      "Designer",
    ]);
  });

  it.each([
    [null, null, "overview"],
    ["library", null, "library"],
    ["explorer", null, "library"],
    ["import", null, "imports"],
    ["lore", null, "imports"],
    ["sync", null, "imports"],
    ["takedowns", null, "compliance"],
    ["settings", "packs", "packs"],
    ["settings", "takedowns", "compliance"],
    ["settings", "seasons", "seasons"],
    ["settings", null, "economy"],
    ["nonsense", null, "overview"],
    ["constructor", null, "overview"],
    ["settings", "__proto__", "economy"],
  ])("?tab=%s&subtab=%s opens %s", (tab, subtab, expected) => {
    expect(cardsAdminTabFromParam(tab, subtab)).toBe(expected);
  });
});
