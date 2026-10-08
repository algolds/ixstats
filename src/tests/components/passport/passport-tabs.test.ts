/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_PASSPORT_TAB,
  parsePassportTab,
  passportRibbonCounts,
} from "~/components/passport/passport-tabs";

describe("parsePassportTab", () => {
  it("opens Realms by default, and for the removed Overview tab's names", () => {
    expect(DEFAULT_PASSPORT_TAB).toBe("realms");
    expect(parsePassportTab("overview")).toBe("realms");
    expect(parsePassportTab("Overview")).toBe("realms");
    expect(parsePassportTab("passport")).toBe("realms");
    expect(parsePassportTab("realms")).toBe("realms");
  });

  it("opens Collection for the old Vault tab", () => {
    expect(parsePassportTab("vault")).toBe("collection");
    expect(parsePassportTab("collection")).toBe("collection");
  });

  it("keeps older Work links working: lore and wiki open Work", () => {
    expect(parsePassportTab("lore")).toBe("work");
    expect(parsePassportTab("wiki")).toBe("work");
    expect(parsePassportTab("work")).toBe("work");
    expect(parsePassportTab("history")).toBe("history");
  });

  it("ignores absent, unknown and prototype-named values", () => {
    expect(parsePassportTab(null)).toBeNull();
    expect(parsePassportTab("")).toBeNull();
    expect(parsePassportTab("settings")).toBeNull();
    expect(parsePassportTab("constructor")).toBeNull();
  });
});

describe("passportRibbonCounts", () => {
  it("counts the collection's cards and gives Realms no count", () => {
    // The front face already states realms and nations; a bare number beside "Realms" would
    // read as a realm count while the tab lists nations.
    expect(passportRibbonCounts({ vault: { totalCards: 7 } })).toEqual({ collection: 7 });
  });

  it("gives no collection count when the collection is hidden", () => {
    expect(passportRibbonCounts({ vault: null })).toEqual({});
  });
});
