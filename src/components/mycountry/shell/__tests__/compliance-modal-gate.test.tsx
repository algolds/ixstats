/**
 * The compliance prompt reads its localStorage snooze with `use(browser())` under a Suspense
 * boundary, so the first client render already knows the stored value.
 */
import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MyCountryComplianceModal } from "~/components/mycountry/shared/modals/MyCountryComplianceModal";
import { ComplianceModalGate } from "../MyCountryRouter";
import type { ComplianceSectionStatus } from "~/lib/mycountry/compliance";

jest.mock("next/navigation", () => ({
  usePathname: () => "/mycountry",
  useRouter: () => ({ push: jest.fn() }),
}));

// Delegates to the real modal but records each call's props, so a test can tell a closed modal
// from a gate that returned null (Radix renders nothing in either case once the sheet is shut).
jest.mock("~/components/mycountry/shared/modals/MyCountryComplianceModal", () => {
  const actual = jest.requireActual(
    "~/components/mycountry/shared/modals/MyCountryComplianceModal"
  );
  return { ...actual, MyCountryComplianceModal: jest.fn(actual.MyCountryComplianceModal) };
});

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

function gate(isOpen: boolean, onRemindLater = jest.fn()) {
  return (
    <Suspense fallback={null}>
      <ComplianceModalGate
        isOpen={isOpen}
        storageKey={STORAGE_KEY}
        sections={SECTIONS}
        onReview={jest.fn()}
        onRemindLater={onRemindLater}
      />
    </Suspense>
  );
}

function renderGate(onRemindLater = jest.fn()) {
  return render(gate(true, onRemindLater));
}

describe("ComplianceModalGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.mocked(MyCountryComplianceModal).mockClear();
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

  it("calls onRemindLater from the Remind me later button", async () => {
    const onRemindLater = jest.fn();
    renderGate(onRemindLater);
    fireEvent.click(await screen.findByRole("button", { name: /remind me later/i }));
    expect(onRemindLater).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal mounted, closed, after Remind me later stores a fresh snooze", async () => {
    const view = renderGate();
    expect(await screen.findByRole("dialog")).toBeTruthy();

    // What handleRemindLater does, then the router flips isOpen off.
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + 12 * 60 * 60 * 1000));
    jest.mocked(MyCountryComplianceModal).mockClear();
    view.rerender(gate(false));
    await act(async () => {});

    // A gate that returned null would never call the modal again; the closed Sheet is what slides out.
    const calls = jest.mocked(MyCountryComplianceModal).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([props]) => props.isOpen === false)).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
