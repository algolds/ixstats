/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import {
  parsePassportTab,
  passportRibbonCounts,
} from "~/components/passport/passport-tabs";

describe("parsePassportTab", () => {
  it("ignores absent, unknown and prototype-named values", () => {
    expect(parsePassportTab(null)).toBeNull();
    expect(parsePassportTab("")).toBeNull();
    expect(parsePassportTab("settings")).toBeNull();
    expect(parsePassportTab("constructor")).toBeNull();
  });
});

describe("passportRibbonCounts", () => {
  it("gives no collection count when the collection is hidden", () => {
    expect(passportRibbonCounts({ vault: null })).toEqual({});
  });
});
