/**
 * Exchange Facet chrome: PageHeader without "v2", SegmentedControl section switcher,
 * standard "Buy or sell" CTA, and retryable EmptyState error/empty surfaces without decorative monospace chips.
 */
import { fireEvent, render, screen } from "@testing-library/react";

let mockPathname = "/exchange";
const mockPush = jest.fn();
let mockTreasury: { countryId: string; name: string } | null = null;
let mockFrontError: { message: string } | null = null;
const mockFrontRefetch = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
}));
jest.mock("~/hooks/useViewerRealmId", () => ({
  useViewerRealmId: () => "default",
}));
jest.mock("~/components/exchange/terminal/useTreasuryActor", () => ({
  useRealmOverview: () => ({ data: { wallet: { sovereigns: 1250 } } }),
  useTreasuryActor: () => mockTreasury,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ exchange: { invalidate: jest.fn() } }),
    exchange: {
      frontPage: {
        useQuery: () => ({
          data: undefined,
          isLoading: false,
          error: mockFrontError,
          refetch: mockFrontRefetch,
        }),
      },
      getOverview: { useQuery: () => ({ data: undefined }) },
      getSectors: { useQuery: () => ({ data: [] }) },
      markets: {
        useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
      },
      setSectorDmModifier: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      toggleWatch: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));

import { ExchangeHeader } from "~/components/exchange/terminal/ExchangeHeader";
import { FrontPage } from "~/components/exchange/terminal/FrontPage";
import { MarketsPage } from "~/components/exchange/terminal/MarketsPage";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

beforeEach(() => {
  mockPathname = "/exchange";
  mockTreasury = null;
  mockFrontError = null;
  mockPush.mockReset();
  mockFrontRefetch.mockReset();
});

describe("ExchangeHeader and Facet empty/error states", () => {
  it("renders PageHeader without a v2 tag, exposes SegmentedControl tabs, and shows Buy or sell on Overview", () => {
    render(<ExchangeHeader realmId="default" panelId="exchange-panel" />);
    expect(screen.getByRole("heading", { level: 1, name: "Exchange" })).toBeInTheDocument();
    expect(screen.queryByText("v2")).toBeNull();
    expect(screen.getByRole("link", { name: /buy or sell/i })).toHaveAttribute(
      "href",
      "/exchange/markets?focus=search"
    );
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Treasury" })).toBeNull();

    const marketsTab = screen.getByRole("tab", { name: "Markets" });
    fireEvent.keyDown(marketsTab, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/exchange/markets");
  });

  it("hides Buy or sell on /exchange/markets and includes Treasury when the viewer owns a nation", () => {
    mockPathname = "/exchange/markets";
    mockTreasury = { countryId: "c1", name: "Caphiria" };
    render(<ExchangeHeader realmId="default" panelId="exchange-panel" />);
    expect(screen.queryByRole("link", { name: /buy or sell/i })).toBeNull();
    expect(screen.getByRole("tab", { name: "Treasury" })).toBeInTheDocument();
  });

  it("renders retryable EmptyState on FrontPage error and clean EmptyState without '0 listed' on MarketsPage", () => {
    mockFrontError = { message: "Upstream timeout" };
    const { unmount } = render(<FrontPage realmId="default" />);
    expect(screen.getByText("The Exchange did not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockFrontRefetch).toHaveBeenCalledTimes(1);
    unmount();

    mockPathname = "/exchange/markets";
    render(<MarketsPage realmId="default" />);
    expect(screen.getByText("Nothing listed here yet")).toBeInTheDocument();
    expect(screen.queryByText("0 listed")).toBeNull();
  });
});
