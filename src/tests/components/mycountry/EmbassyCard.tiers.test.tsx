import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";

jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));

jest.mock("~/components/mycountry/shared/primitives", () => {
  const actual = jest.requireActual("~/components/mycountry/shared/primitives");
  return { ...actual, useCountryData: () => ({ country: { name: "Alpha" } }) };
});

import { EmbassyCard } from "~/components/mycountry/domains/diplomacy/embassy-network/EmbassyCard";
import { calculateRelativeDevelopment } from "~/lib/diplomacy/relative-development";

const embassy = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  name: "Alpha Embassy in Beta",
  hostCountry: "Beta",
  guestCountry: "Alpha",
  status: "active",
  strength: 60,
  totalSynergyScore: 0,
  economicBonus: 0,
  diplomaticBonus: 0,
  culturalBonus: 0,
  synergies: [],
  ...over,
});

const LABELS = /Symmetrical Partner|Capital Imbalance|Resource Synergist|Superpower Influence/;

describe("calculateRelativeDevelopment", () => {
  it("ranks the real Country.economicTier values", () => {
    expect(calculateRelativeDevelopment("Developed", "Developed")?.label).toBe(
      "Symmetrical Partner"
    );
    expect(calculateRelativeDevelopment("Developed", "Healthy")?.label).toBe("Capital Imbalance");
    expect(calculateRelativeDevelopment("Developing", "Extravagant")?.label).toBe(
      "Superpower Influence"
    );
    expect(calculateRelativeDevelopment("Very Strong", "Impoverished")?.label).toBe(
      "Resource Synergist"
    );
  });

  it("returns null instead of assuming a tier", () => {
    expect(calculateRelativeDevelopment(null, "Developed")).toBeNull();
    expect(calculateRelativeDevelopment("Developed", undefined)).toBeNull();
    expect(calculateRelativeDevelopment("SUPERPOWER", "Developed")).toBeNull();
  });
});

describe("EmbassyCard asymmetry badge", () => {
  it("is hidden when the tiers are unknown", () => {
    const { container } = render(
      <EmbassyCard embassy={embassy()} isOwner={false} onClick={() => {}} />
    );
    expect(container.textContent).not.toMatch(LABELS);
  });

  it("shows the real asymmetry from the viewed country's side", () => {
    // Viewed as the guest (Developing) with a much richer host: the partner dominates.
    const { unmount } = render(
      <EmbassyCard
        embassy={embassy({
          role: "guest",
          guestCountryTier: "Developing",
          hostCountryTier: "Strong",
        })}
        isOwner={false}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Superpower Influence")).toBeTruthy();
    unmount();

    // Same embassy viewed from the host: the partner is the poorer side.
    render(
      <EmbassyCard
        embassy={embassy({
          role: "host",
          guestCountryTier: "Developing",
          hostCountryTier: "Strong",
        })}
        isOwner={false}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Resource Synergist")).toBeTruthy();
  });
});
