/** Nation, bond and story pages: the nation's currency shown only with a rate, a defaulted bond flagged, a story linking its subjects. */
import { render, screen } from "@testing-library/react";

let mockNation: object | undefined;
let mockBond: object | undefined;
let mockStory: object | undefined;

jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: false, isLoaded: true }) }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/exchange",
  useSearchParams: () => new URLSearchParams(""),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ exchange: { invalidate: jest.fn() } }),
    exchange: {
      getOverview: { useQuery: () => ({ data: undefined }) },
      nationPage: { useQuery: () => ({ data: mockNation, isLoading: false, error: null }) },
      bondPage: { useQuery: () => ({ data: mockBond, isLoading: false, error: null }) },
      story: { useQuery: () => ({ data: mockStory, isLoading: false, error: null }) },
      toggleWatch: { useMutation: () => ({ mutate: jest.fn() }) },
    },
  },
}));

import { BondPage } from "~/components/exchange/terminal/BondPage";
import { NationPage } from "~/components/exchange/terminal/NationPage";
import { StoryPage } from "~/components/exchange/terminal/StoryPage";

const nation = (currencyRate: number | null) => ({
  id: "x1",
  name: "Caphiria",
  flagUrl: null,
  realmId: "default",
  currency: "taler",
  currencySymbol: "T",
  currencyRate,
  rating: "AA",
  treasury: { balance: 5000, cap: 25000, recent: [] },
  bonds: [],
  companies: [],
  news: [],
  viewer: { watching: false },
});

describe("NationPage", () => {
  it("shows the ₷ rate only when MyCountry sets one", () => {
    mockNation = nation(4.2);
    const { unmount } = render(<NationPage countryId="x1" />);
    expect(screen.getByText("₷ 1 ≈ 4.2 taler")).toBeInTheDocument();
    unmount();
    mockNation = nation(null);
    render(<NationPage countryId="x1" />);
    expect(screen.queryByText(/≈/)).toBeNull();
    expect(screen.getByText(/taler/)).toBeInTheDocument();
  });
});

describe("BondPage", () => {
  it("flags a defaulted bond", () => {
    mockBond = {
      bond: {
        bondId: "b1",
        countryId: "x1",
        nation: "Caphiria",
        couponRate: 0.1,
        termWeeks: 4,
        weeksLeft: 3,
        price: 10,
        yield: 1,
        rating: "D",
        status: "DEFAULTED",
        unitsIssued: 100,
        unitsSold: 100,
        faceValue: 100,
        weeksPaid: 0,
      },
      listings: [],
      holderCount: 2,
      news: [],
      viewer: { watching: false, units: 0 },
    };
    render(<BondPage bondId="b1" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Caphiria 4-week bond" })
    ).toBeInTheDocument();
    expect(screen.getByText("This bond is in default")).toBeInTheDocument();
  });
});

describe("StoryPage", () => {
  it("links the story to its company", () => {
    mockStory = {
      id: "n1",
      headline: "Caphirian Steel pays a ₷500 dividend",
      body: null,
      sourceName: "Caphirian Steel",
      createdAt: new Date(),
      movePct: null,
      companyId: "c1",
      bondId: null,
      countryId: null,
    };
    render(<StoryPage newsId="n1" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /pays a ₷500 dividend/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The company" })).toHaveAttribute(
      "href",
      "/exchange/c/c1"
    );
  });
});
