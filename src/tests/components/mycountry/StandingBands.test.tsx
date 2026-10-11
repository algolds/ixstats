import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";

let mockExecBandwidth: any = null;
let mockIntentStatus: any = null;
let mockCountryData: any = {};

jest.mock("~/trpc/react", () => ({
  api: {
    intent: {
      getStatus: { useQuery: () => ({ data: mockIntentStatus }) },
    },
    policies: {
      getPolicyReconContext: { useQuery: () => ({ data: mockExecBandwidth }) },
    },
  },
}));

jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));

jest.mock("~/lib/sound/cuelume", () => ({
  soundEffects: { bloom: jest.fn(), toggle: jest.fn() },
}));

jest.mock("~/components/mycountry/shared/primitives", () => {
  const actual = jest.requireActual("~/components/mycountry/shared/primitives");
  return { ...actual, useCountryData: () => mockCountryData };
});

import {
  StandingBands,
  describeExecBandwidthBand,
} from "~/components/mycountry/shell/StandingBands";

const country = {
  id: "c1",
  name: "Testland",
  currentPopulation: 1_000_000,
  currentTotalGdp: 5e10,
  publicApproval: 61,
  stabilityMetrics: { stabilityScore: 72 },
};

describe("describeExecBandwidthBand", () => {
  it("shows real executive bandwidth used/capacity with directive slots in the tooltip", () => {
    const band = describeExecBandwidthBand(
      {
        capacity: 180,
        used: 42,
        available: 138,
        overCapacity: false,
        breakdown: {
          governmentStaff: 10,
          recon: 0,
          policies: 20,
          directives: 12,
          delegatedIssues: 0,
        },
      },
      { used: 1, cap: 3 }
    );
    expect(band.value).toBe("42/180");
    expect(band.title).toContain("138 available");
    expect(band.title).toContain("directives 12");
    expect(band.title).toContain("Directives this week: 1/3");
  });

  it("shows a dash when executive bandwidth is unavailable", () => {
    expect(describeExecBandwidthBand(null, { used: 0, cap: 3 }).value).toBe("—");
  });
});

describe("StandingBands", () => {
  beforeEach(() => {
    mockExecBandwidth = {
      capacity: 200,
      used: 57,
      available: 143,
      overCapacity: false,
      breakdown: {
        governmentStaff: 20,
        recon: 0,
        policies: 25,
        directives: 12,
        delegatedIssues: 0,
      },
    };
    mockIntentStatus = { usedThisWeek: 2, cap: 3, canCommit: true };
    mockCountryData = {
      country,
      activityRingsData: {
        economicVitality: 64,
        populationWellbeing: 58,
        diplomaticStanding: null,
        governmentalEfficiency: 47,
      },
    };
  });

  it("labels the band Bandwidth and shows bandwidth, not directive slots", () => {
    render(<StandingBands countryId="c1" />);
    const band = screen.getByTestId("exec-bandwidth-band");

    expect(band.textContent).toContain("Bandwidth");
    expect(band.textContent).toContain("57/200");
    expect(band.textContent).not.toContain("2/3");
    expect(band.getAttribute("title")).toContain("Directives this week: 2/3");
  });

  it("shows server-computed rings and a dash for a ring with no data", () => {
    const { container } = render(<StandingBands countryId="c1" />);

    expect(container.textContent).toContain("64/100");
    expect(container.textContent).toContain("47/100");
    // The old fake constant (70) never shows up for diplomacy.
    expect(container.textContent).not.toContain("70/100");
    // Diplomatic Standing has no data: a dash, never an invented number.
    expect(screen.getByTitle("No data yet").textContent).toBe("—");
  });

  it("shows real approval and stability", () => {
    render(<StandingBands countryId="c1" />);
    expect(screen.getByText("61%")).toBeTruthy();
    expect(screen.getByText("72%")).toBeTruthy();
  });
});
