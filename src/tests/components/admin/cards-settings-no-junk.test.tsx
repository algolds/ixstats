/** Cards refresh §5.4: the card settings admin has no junk controls (the payout and its batch limit are gone). */
import { render, screen } from "@testing-library/react";
import { CardGeneralSettingsAdmin } from "~/app/admin/cards/CardGeneralSettingsAdmin";
import { ValuationAdmin } from "~/app/admin/cards/ValuationAdmin";

jest.mock("~/trpc/react", () => {
  const query = (data: Record<string, number>) => ({
    useQuery: () => ({ data, isLoading: false, refetch: jest.fn() }),
  });
  const mutation = () => ({ useMutation: () => ({ mutate: jest.fn(), isPending: false }) });
  return {
    api: {
      cards: {
        getGeneralConfig: query({ auctionHouseRakePct: 10, maxInventoryCards: 150 }),
        setGeneralConfig: mutation(),
        getValuationConfig: query({ nsPremium: 1.5 }),
        setValuationConfig: mutation(),
        recomputeCardValues: mutation(),
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

describe("card settings admin", () => {
  it("shows the capacity, and no junk batch limit", () => {
    render(<CardGeneralSettingsAdmin />);
    expect(screen.getByText("Base card capacity")).toBeTruthy();
    expect(screen.queryAllByText(/junk/i)).toHaveLength(0);
  });

  it("shows the valuation curve, and no junk payout rate", () => {
    render(<ValuationAdmin />);
    expect(screen.getByText("NS import premium ×")).toBeTruthy();
    expect(screen.queryAllByText(/junk/i)).toHaveLength(0);
  });
});
