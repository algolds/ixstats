import "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";

let mockInboxCount = 0;
let mockCountry: Record<string, unknown> | null = null;

jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: mockCountry }),
}));

jest.mock("~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox", () => ({
  useDiplomacyInboxCount: () => ({ count: mockInboxCount, isLoading: false, isError: false }),
}));

import { DomainPeeksCard } from "~/components/mycountry/shell/DomainPeeksCard";

describe("DomainPeeksCard", () => {
  beforeEach(() => {
    mockInboxCount = 0;
    mockCountry = {
      id: "c1",
      stabilityMetrics: { stabilityScore: 71.4 },
      calculatedStats: { gdpGrowth: 0.034 },
    };
  });
  it("switches sections in place on a plain click and leaves modified clicks to the browser", () => {
    const calls: string[] = [];
    render(<DomainPeeksCard onNavigate={(s) => calls.push(s)} />);
    const directives = screen.getByRole("link", { name: /Directives/ });
    expect(fireEvent.click(directives)).toBe(false);
    expect(calls).toEqual(["executive"]);
    expect(fireEvent.click(directives, { metaKey: true })).toBe(true);
    expect(calls).toEqual(["executive"]);
  });
});
