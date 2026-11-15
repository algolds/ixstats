import { render, screen } from "@testing-library/react";
import { ixnayReader } from "~/tests/fixtures/realm-readers";

let mockElectionStatus: Record<string, unknown> | undefined;

jest.mock("iconoir-react", () => new Proxy({}, { get: () => () => null }));
jest.mock("~/hooks/useNationClock", () => ({
  useNationClock: () => ixnayReader(),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      elections: { invalidate: jest.fn() },
      legislation: { invalidate: jest.fn() },
    }),
    elections: {
      getElectionStatus: {
        useQuery: () => ({ data: mockElectionStatus }),
      },
      resolveDueElection: {
        useMutation: () => ({ mutate: jest.fn(), isPending: false, error: null }),
      },
    },
  },
}));

import { ElectionStatusCard } from "~/components/executive/politics/ElectionStatusCard";

describe("ElectionStatusCard", () => {
  it("collapses duplicate party result rows without React duplicate-key errors", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockElectionStatus = {
      nowIxTime: 1_700_000_000_000,
      minParties: 2,
      hasLegislature: true,
      hasElectedChamber: true,
      totalSeats: 100,
      seatedSeats: 100,
      activeParties: 2,
      counting: false,
      upcoming: null,
      lastElection: {
        id: "el_1",
        name: "General Election (Year 2041)",
        scheduledIxTime: 1_700_000_000_000,
        turnout: 74,
        marginOfVictory: 100,
        results: [
          {
            partyId: "cmn82fnd5005frp5zdpn2nui6",
            partyName: "Kiro-Caphirian Movement",
            color: "#6366f1",
            votePercentage: 50.84,
            seatsWon: 100,
          },
          {
            partyId: "cmn82fnd5005frp5zdpn2nui6",
            partyName: "Kiro-Caphirian Movement",
            color: "#6366f1",
            votePercentage: 49.16,
            seatsWon: 100,
          },
        ],
      },
    };

    render(<ElectionStatusCard countryId="country_1" />);

    expect(screen.getAllByText("Kiro-Caphirian Movement")).toHaveLength(1);
    expect(screen.getByText("100.0% · 100 seats")).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
