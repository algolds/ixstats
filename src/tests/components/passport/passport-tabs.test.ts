/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import { DEFAULT_PASSPORT_TAB, parsePassportTab } from "~/components/passport/passport-tabs";

describe("parsePassportTab (plan 188)", () => {
  it("opens the Overview tab by default and for the plan's `passport` name", () => {
    expect(DEFAULT_PASSPORT_TAB).toBe("overview");
    expect(parsePassportTab("passport")).toBe("overview");
    expect(parsePassportTab("Overview")).toBe("overview");
  });

  it("keeps pre-plan links working: lore and wiki open Work", () => {
    expect(parsePassportTab("lore")).toBe("work");
    expect(parsePassportTab("wiki")).toBe("work");
    expect(parsePassportTab("work")).toBe("work");
    expect(parsePassportTab("realms")).toBe("realms");
    expect(parsePassportTab("vault")).toBe("vault");
    expect(parsePassportTab("history")).toBe("history");
  });

  it("ignores absent, unknown and prototype-named values", () => {
    expect(parsePassportTab(null)).toBeNull();
    expect(parsePassportTab("")).toBeNull();
    expect(parsePassportTab("settings")).toBeNull();
    expect(parsePassportTab("constructor")).toBeNull();
  });
});
