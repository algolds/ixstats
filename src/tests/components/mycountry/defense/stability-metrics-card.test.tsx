/** Internal stability reads as a rating word and its levels as words over meters, never as percentages. */
import { render, screen } from "@testing-library/react";

jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value}</span>,
}));
jest.mock("~/components/mycountry/domains/defense/stability/StabilityHelpDialog", () => ({
  StabilityHelpDialog: () => null,
}));

import { StabilityMetricsCard } from "~/components/mycountry/domains/defense/stability/StabilityMetricsCard";

const metrics = {
  stabilityScore: 63,
  stabilityTrend: "stable",
  crimeRate: 410,
  violentCrimeRate: 90,
  propertyCrimeRate: 320,
  organizedCrimeLevel: 12,
  policingEffectiveness: 71,
  justiceSystemEfficiency: 55,
  protestFrequency: 4,
  riotRisk: 22,
  civilDisobedience: 9,
  socialCohesion: 64,
  ethnicTension: 30,
  politicalPolarization: 48,
  trustInGovernment: 58,
  trustInPolice: 83,
  fearOfCrime: 40,
};

it("rates the overall score in a word and keeps percentages out", () => {
  const { container } = render(<StabilityMetricsCard metrics={metrics} />);
  expect(screen.getByText("Stable")).toBeTruthy();
  expect(container.textContent).not.toMatch(/%/);
});

it("reads each level as a word with its meter", () => {
  render(<StabilityMetricsCard metrics={metrics} />);
  expect(screen.getByRole("progressbar", { name: "Trust in police" })).toBeTruthy();
  expect(screen.getByText("Trust in police").parentElement?.textContent).toBe(
    "Trust in policeVery high"
  );
  expect(screen.getByText("Riot risk").parentElement?.textContent).toBe("Riot riskLow");
});
