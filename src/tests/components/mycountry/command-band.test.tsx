/**
 * The command band's meter cluster: bandwidth as a count over a meter, directive slots as pips,
 * stability as a rating word. None of them is a percentage.
 */
import { render, screen, within } from "@testing-library/react";

const mockStatus = { usedThisWeek: 1, cap: 3 };
const mockBandwidth = { capacity: 158, used: 40, available: 118, overCapacity: false };
let mockStabilityScore: number | null = 63;

jest.mock("~/trpc/react", () => ({
  api: {
    intent: { getStatus: { useQuery: () => ({ data: mockStatus }) } },
    policies: { getPolicyReconContext: { useQuery: () => ({ data: mockBandwidth }) } },
    nationalIssues: { getPendingCount: { useQuery: () => ({ data: { total: 0, urgent: 0 } }) } },
  },
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { name: "Eldoria" } }),
}));
jest.mock("~/hooks/useInternalStability", () => ({
  useInternalStability: () => ({
    metrics: mockStabilityScore === null ? undefined : { stabilityScore: mockStabilityScore },
  }),
}));
jest.mock("~/components/mycountry/directives/BandwidthHelp", () => ({
  BandwidthHelp: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

import { CommandBand } from "~/components/mycountry/shell/face/CommandBand";

const renderBand = () =>
  render(<CommandBand countryId="c1" rings={[]} onOpenRings={() => undefined} />);

afterEach(() => {
  mockStabilityScore = 63;
});

it("reads bandwidth as a count of its capacity, never a percentage", () => {
  renderBand();
  const band = screen.getByTestId("exec-bandwidth-band");
  expect(band.textContent).toContain("40 of 158");
  expect(screen.getByLabelText("Command readings").textContent).not.toMatch(/%/);
});

it("draws one pip per directive slot, the used ones filled", () => {
  renderBand();
  const slots = screen.getByRole("group", { name: "Directive slots: 1 of 3 used this week" });
  const pips = slots.querySelectorAll("span.flex-1");
  expect(pips).toHaveLength(3);
  expect([...pips].map((pip) => pip.classList.contains("bg-label-secondary"))).toEqual([
    true,
    false,
    false,
  ]);
});

it("rates stability in a word", () => {
  renderBand();
  const stability = screen.getByRole("group", { name: "Internal stability: Stable" });
  expect(within(stability).getByText("Stable")).toBeTruthy();
});

it("shows a dash while stability is unknown", () => {
  mockStabilityScore = null;
  renderBand();
  expect(screen.getByRole("group", { name: "Internal stability unavailable" })).toBeTruthy();
});
