/** P1-09: the Defense drill sheet uses the same premium lock as the Defense page. */
import React from "react";
import { render, screen } from "@testing-library/react";

let premiumAbility = false;

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const Stub = () => <div data-testid="defense-panel" />;
    return Stub;
  },
}));
jest.mock("~/components/providers/AbilityProvider", () => ({
  useAbility: () => ({
    can: (action: string, subject: string, section: string) =>
      premiumAbility && action === "access" && subject === "MyCountryFeature" && section === "defense",
  }),
}));
jest.mock("~/hooks/usePermissions", () => ({ useIsBetaTester: () => false }));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  PremiumPreviewFrame: ({ locked, children }: { locked: boolean; children: React.ReactNode }) => (
    <div data-testid="premium-frame" data-locked={String(locked)}>
      {children}
    </div>
  ),
}));
jest.mock("~/components/mycountry/shell/IntentDetail", () => ({ IntentDetail: () => null }));
jest.mock("~/components/mycountry/shared/headers/IssueDetailBrief", () => ({
  IssueDetailBrief: () => null,
}));

import { DrillSheets } from "~/components/mycountry/shell/DrillSheets";

const renderDefenseDrill = () =>
  render(<DrillSheets drill={{ kind: "defense" }} onClose={jest.fn()} countryId="c1" />);
const frame = () => screen.getByTestId("premium-frame");

beforeEach(() => {
  premiumAbility = false;
});

it("locks the Defense drill for a free user", () => {
  renderDefenseDrill();
  expect(frame().getAttribute("data-locked")).toBe("true");
  expect(frame().querySelector("[data-testid=defense-panel]")).not.toBeNull();
});

it("unlocks the Defense drill for a premium user", () => {
  premiumAbility = true;
  renderDefenseDrill();
  expect(frame().getAttribute("data-locked")).toBe("false");
});

// P2-12: the issue brief has no blurb, so its sheet renders no empty description paragraph under the title.
it("renders no empty description under the issue brief title", () => {
  render(<DrillSheets drill={{ kind: "issue", issueId: "i1" }} onClose={jest.fn()} countryId="c1" />);
  const dialog = screen.getByRole("dialog");
  expect(screen.getByRole("heading", { name: "Issue brief" })).toBeTruthy();
  expect(dialog.querySelectorAll("p")).toHaveLength(0);
  expect(dialog.getAttribute("aria-describedby")).toBeNull();
});

it("keeps the description on a domain sheet", () => {
  renderDefenseDrill();
  const describedBy = screen.getByRole("dialog").getAttribute("aria-describedby");
  expect(describedBy && document.getElementById(describedBy)?.textContent).toBeTruthy();
});
