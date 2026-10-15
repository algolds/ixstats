/**
 * Links into the country editor land on the section they are about, and the profile checklist's
 * Review goes to whatever owns the first missing item.
 */
import {
  complianceReviewHref,
  editorHref,
  MYCOUNTRY_BUDGET_PATH,
  MYCOUNTRY_ECONOMY_PATH,
  MYCOUNTRY_TAX_PATH,
} from "~/lib/mycountry/routes";
import { identityFieldError } from "~/lib/mycountry/editor-fields";

describe("editor links", () => {
  it("deep-links to a section", () => {
    expect(editorHref("government")).toBe("/mycountry/editor#government");
    expect(editorHref("identity")).toBe("/mycountry/editor#identity");
  });

  it.each([
    [{ id: "national-identity", missing: ["Demonym"] }, "/mycountry/editor#identity"],
    [{ id: "government", missing: ["Government type"] }, "/mycountry/editor#government"],
    [{ id: "government", missing: ["Budget allocations"] }, MYCOUNTRY_BUDGET_PATH],
    [{ id: "economy", missing: ["Inflation rate"] }, MYCOUNTRY_ECONOMY_PATH],
    [{ id: "taxes", missing: ["Tax categories"] }, MYCOUNTRY_TAX_PATH],
    [undefined, "/mycountry/editor#identity"],
  ])("reviews %j at %s", (section, href) => {
    expect(complianceReviewHref(section)).toBe(href);
  });
});

describe("identity field checks", () => {
  it("accepts empty values and well-formed codes", () => {
    expect(identityFieldError("isoCode", "")).toBeNull();
    expect(identityFieldError("isoCode", "EL")).toBeNull();
    expect(identityFieldError("internetTLD", ".el")).toBeNull();
    expect(identityFieldError("callingCode", "+35")).toBeNull();
    expect(identityFieldError("drivingSide", "left")).toBeNull();
  });

  it("explains what is wrong", () => {
    expect(identityFieldError("isoCode", "E1")).toBe("Use 2 or 3 letters.");
    expect(identityFieldError("internetTLD", "el")).toMatch(/Start with a dot/);
    expect(identityFieldError("drivingSide", "middle")).toBe("Pick one option.");
  });
});
