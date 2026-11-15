/**
 * The trade sheet: amount and side in, one request id per attempt (a retry reuses it, a success starts a new one),
 * shares through the order book at the best price, bonds from the treasury while units remain, signed-out a sign-in.
 */
import { fireEvent, render, screen } from "@testing-library/react";

type Options = { onSuccess?: () => void };
const mocks = {
  placeBuyOrder: jest.fn(),
  listShares: jest.fn(),
  buyBondPrimary: jest.fn(),
  buyBondListing: jest.fn(),
  listBondUnits: jest.fn(),
  buySectorUnits: jest.fn(),
  sellSectorUnits: jest.fn(),
  fundTrade: jest.fn(),
};
type MutationState = { error: { message: string } | null; variables?: { requestId: string } };
const states: Partial<Record<keyof typeof mocks, MutationState>> = {};
const successes: Record<string, (() => void) | undefined> = {};
let mockSignedIn = true;

jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: mockSignedIn, isLoaded: true }),
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/exchange/c/c1",
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("~/trpc/react", () => {
  const mutation = (name: keyof typeof mocks) => ({
    useMutation: (options: Options = {}) => {
      successes[name] = options.onSuccess;
      return { mutate: mocks[name], isPending: false, error: null, ...states[name] };
    },
  });
  return {
    api: {
      useUtils: () => ({ exchange: { invalidate: jest.fn() } }),
      exchange: {
        placeBuyOrder: mutation("placeBuyOrder"),
        listShares: mutation("listShares"),
        buyBondPrimary: mutation("buyBondPrimary"),
        buyBondListing: mutation("buyBondListing"),
        listBondUnits: mutation("listBondUnits"),
        buySectorUnits: mutation("buySectorUnits"),
        sellSectorUnits: mutation("sellSectorUnits"),
        fundTrade: mutation("fundTrade"),
      },
    },
  };
});

import { TradeSheet } from "~/components/exchange/terminal/TradeSheet";

const share = {
  kind: "share" as const,
  companyId: "c1",
  name: "Caphirian Steel",
  price: 11,
  bestAsk: 12,
  bestBid: 10,
};

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  for (const name of Object.keys(states)) delete states[name as keyof typeof mocks];
  mockSignedIn = true;
});

function buy(amount: string) {
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
}

describe("TradeSheet", () => {
  it("buys shares at the best ask, reusing the request id on a retry and starting a new one after success", () => {
    render(<TradeSheet instrument={share} open onOpenChange={() => undefined} />);
    buy("10");
    buy("10");
    const [first, second] = mocks.placeBuyOrder.mock.calls.map(([input]) => input);
    expect(first).toMatchObject({ companyId: "c1", shares: 10, maxPricePerShare: 12 });
    expect(second.requestId).toBe(first.requestId);
    expect(first.requestId.length).toBeGreaterThanOrEqual(8);
  });

  it("buys a bond from the treasury while units remain", () => {
    render(
      <TradeSheet
        instrument={{
          kind: "bond",
          bondId: "b1",
          name: "Urcea 5-week bond",
          price: 100,
          faceValue: 100,
          unitsLeft: 50,
          cheapestListing: null,
        }}
        open
        onOpenChange={() => undefined}
      />
    );
    buy("5");
    expect(mocks.buyBondPrimary).toHaveBeenCalledWith(
      expect.objectContaining({ bondId: "b1", units: 5 }),
      expect.anything()
    );
  });

  it("asks a signed-out visitor to sign in", () => {
    mockSignedIn = false;
    render(<TradeSheet instrument={share} open onOpenChange={() => undefined} />);
    expect(screen.getByText("Sign in to trade")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  it("preserves entered amount and side when toggling Trade as", () => {
    render(
      <TradeSheet
        instrument={share}
        treasury={{ countryId: "x1", name: "Caphiria" }}
        open
        onOpenChange={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Sell" }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("radio", { name: "Caphiria Treasury" }));
    expect(screen.getByLabelText("Amount")).toHaveValue("25");
    expect(screen.getByRole("radio", { name: "Sell" })).toBeChecked();
  });

  it("disables buying when a bond has no primary or secondary units available", () => {
    render(
      <TradeSheet
        instrument={{
          kind: "bond",
          bondId: "b1",
          name: "Urcea 5-week bond",
          price: 100,
          faceValue: 100,
          unitsLeft: 0,
          cheapestListing: null,
        }}
        open
        onOpenChange={() => undefined}
      />
    );
    expect(screen.getByText("No units available to buy right now")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  describe("Trade as", () => {
    const treasury = { countryId: "x1", name: "Caphiria" };
    const sheet = () => (
      <TradeSheet instrument={share} treasury={treasury} open onOpenChange={() => undefined} />
    );

    it("starts a new attempt, with a new request id, when the actor changes", () => {
      render(sheet());
      buy("10");
      const own = mocks.placeBuyOrder.mock.calls[0]![0].requestId as string;
      fireEvent.click(screen.getByRole("radio", { name: "Caphiria Treasury" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      const fund = mocks.fundTrade.mock.calls[0]![0].requestId as string;
      expect(fund).not.toBe(own);
    });

    it("drops the other actor's failed attempt instead of showing it again", () => {
      const { rerender } = render(sheet());
      buy("10");
      states.placeBuyOrder = {
        error: { message: "No shares for sale" },
        variables: { requestId: mocks.placeBuyOrder.mock.calls[0]![0].requestId },
      };
      rerender(sheet());
      expect(screen.getByText("No shares for sale")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "Caphiria Treasury" }));
      fireEvent.click(screen.getByRole("radio", { name: "You" }));
      expect(screen.queryByText("No shares for sale")).toBeNull();
    });
  });
});
