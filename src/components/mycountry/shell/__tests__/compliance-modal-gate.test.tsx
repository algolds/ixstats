/**
 * The compliance prompt reads its localStorage snooze with `use(browser())` under a Suspense
 * boundary, so the first client render already knows the stored value.
 */
import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { ComplianceModalGate } from "../MyCountryRouter";
import type { ComplianceSectionStatus } from "~/lib/mycountry/compliance";

jest.mock("next/navigation", () => ({
  usePathname: () => "/mycountry",
  useRouter: () => ({ push: jest.fn() }),
}));

const STORAGE_KEY = "ixstats:compliancePrompt:country-1";

const SECTIONS: ComplianceSectionStatus[] = [
  {
    id: "national-identity",
    title: "National identity",
    description: "Name, capital and symbols",
    missing: ["Official name"],
    isComplete: false,
  },
];

function renderGate() {
  return render(
    <Suspense fallback={null}>
      <ComplianceModalGate
        storageKey={STORAGE_KEY}
        sections={SECTIONS}
        onReview={jest.fn()}
        onRemindLater={jest.fn()}
      />
    </Suspense>
  );
}

describe("ComplianceModalGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the prompt when no snooze is stored", async () => {
    renderGate();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("hides the prompt while the 12 hour snooze runs", async () => {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + 60_000));
    renderGate();
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the prompt again once the snooze has lapsed", async () => {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() - 60_000));
    renderGate();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
