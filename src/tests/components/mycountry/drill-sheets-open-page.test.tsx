import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";

jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/components/mycountry/shell/IntentDetail", () => ({ IntentDetail: () => null }));
jest.mock("~/components/mycountry/shared/headers/IssueDetailBrief", () => ({
  IssueDetailBrief: () => null,
}));

import { DrillSheets, type DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";

function openPageHref(drill: DrillSheetKind) {
  render(<DrillSheets drill={drill} onClose={() => undefined} countryId="c1" />);
  return screen.getByRole("link", { name: /Open page/ }).getAttribute("href");
}

describe("DrillSheets Open page link", () => {
  it("opens the economy factbook section for the economy sheet", () => {
    expect(openPageHref({ kind: "economy" })).toBe("/countries/c1/factbook/economy");
  });

  it("opens the country page without a hash for the other domains", () => {
    expect(openPageHref({ kind: "politics" })).toBe("/countries/c1");
  });
});
