import "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockQueries: Record<string, { data?: object | null; isLoading?: boolean }> = {};
const mockLock = jest.fn();
const mockInvalidate = jest.fn(() => Promise.resolve());
const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      thinkpagesForum: {
        thread: { invalidate: mockInvalidate },
        category: { invalidate: mockInvalidate },
      },
    }),
    realms: {
      region: {
        overview: {
          useQuery: () => ({ isLoading: false, ...mockQueries.overview }),
        },
      },
    },
    thinkpagesForum: {
      setAdvertLocked: { useMutation: () => ({ mutateAsync: mockLock, isPending: false }) },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import {
  AdvertLockButton,
  AdvertRailPanel,
} from "~/components/thinkpages-forum/advert";

const overview = (over: object = {}) => ({
  realm: {
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    description: "A world.",
    thumbnail: null,
    bannerUrl: null,
    emblemUrl: null,
    tags: [],
    status: "active",
    foundedAt: new Date("2025-01-01"),
    claimsOpen: true,
  },
  stats: { nations: 4, claimedNations: 3, population: 10 },
  rules: null,
  founder: {
    name: "Aria Vance",
    handle: "aria",
    nation: {
      id: "nation_secret_1",
      name: "Arland",
      slug: "arland",
      flag: "https://img.example/flag.png",
    },
  },
  officers: [
    { title: "Chancellor", powers: ["appearance"], name: "Kir", handle: "kir", nation: null },
    { title: "Envoy", powers: [], name: "Unknown user", handle: null, nation: null },
  ],
  viewer: { signedIn: true, powers: [], isFounder: false, canManage: false, ownedNations: [] },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockQueries)) delete mockQueries[key];
});
describe("AdvertRailPanel", () => {
  it("carries no nation id, officer powers or user id in the markup", () => {
    mockQueries.overview = { data: overview() };
    const { container } = render(<AdvertRailPanel realmSlug="eurth" realmName="Eurth" />);
    expect(container.innerHTML).not.toContain("nation_secret_1");
    expect(container.innerHTML).not.toContain("appearance");
    expect(container.innerHTML).not.toMatch(/\bu_|clerk_/);
  });
});

describe("AdvertLockButton", () => {
  it("locks through the server, then refreshes the thread and the board", async () => {
    mockLock.mockResolvedValue({ locked: true });
    render(<AdvertLockButton threadId="t_ad" />);
    fireEvent.click(screen.getByRole("button", { name: "Lock advert" }));
    await waitFor(() => expect(mockLock).toHaveBeenCalledWith({ threadId: "t_ad", locked: true }));
    await waitFor(() => expect(mockInvalidate).toHaveBeenCalledWith({ threadId: "t_ad" }));
    expect(mockInvalidate).toHaveBeenCalledTimes(2);
  });

  it("reports a refusal and leaves the page as it was", async () => {
    mockLock.mockRejectedValue(new Error("Only the realm's founder can."));
    render(<AdvertLockButton threadId="t_ad" />);
    fireEvent.click(screen.getByRole("button", { name: "Lock advert" }));
    await waitFor(() =>
      expect(mockNotify.error).toHaveBeenCalledWith(
        "Could not lock the advert",
        "Only the realm's founder can."
      )
    );
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
