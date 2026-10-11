import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
  AdvertCard,
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

describe("AdvertCard", () => {
  it("mounts the realm's live card from the overview, with its counts and no online figure", () => {
    mockQueries.overview = { data: overview() };
    render(<AdvertCard realmSlug="eurth" />);
    const card = screen.getByRole("region", { name: "Eurth advert" });
    expect(card).toHaveAttribute("data-content", "entity");
    expect(card).toHaveTextContent("3 members · 4 nations");
    expect(card).not.toHaveTextContent("online");
  });

  it("holds the card's place with a skeleton while the overview loads, then nothing for a hidden realm", () => {
    mockQueries.overview = { isLoading: true };
    const loading = render(<AdvertCard realmSlug="eurth" />);
    expect(loading.container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
    loading.unmount();
    mockQueries.overview = { data: null };
    const hidden = render(<AdvertCard realmSlug="eurth" />);
    expect(hidden.container.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("AdvertRailPanel", () => {
  it("names the realm and lists its founder and officers by handle, with their roles and nations", () => {
    mockQueries.overview = { data: overview() };
    render(<AdvertRailPanel realmSlug="eurth" realmName="Eurth" />);
    const panel = within(
      screen
        .getByRole("heading", { name: "About Eurth" })
        .closest<HTMLElement>("[data-slot='card']")!
    );
    expect(panel.getByRole("link", { name: "@aria" })).toHaveAttribute("href", "/id/aria");
    expect(panel.getByText("Founder")).toBeInTheDocument();
    expect(panel.getByText("Arland")).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "@kir" })).toHaveAttribute("href", "/id/kir");
    expect(panel.getByText("Chancellor")).toBeInTheDocument();
    expect(panel.getByText("Unknown user")).toBeInTheDocument();
    expect(panel.queryByRole("link", { name: "Unknown user" })).toBeNull();
    expect(panel.getByRole("link", { name: "Open the realm page" })).toHaveAttribute(
      "href",
      "/r/eurth"
    );
  });

  it("carries no nation id, officer powers or user id in the markup", () => {
    mockQueries.overview = { data: overview() };
    const { container } = render(<AdvertRailPanel realmSlug="eurth" realmName="Eurth" />);
    expect(container.innerHTML).not.toContain("nation_secret_1");
    expect(container.innerHTML).not.toContain("appearance");
    expect(container.innerHTML).not.toMatch(/\bu_|clerk_/);
  });

  it("shows each person's avatar, and their nation's flag when they hold one", () => {
    mockQueries.overview = { data: overview() };
    const { container } = render(<AdvertRailPanel realmSlug="eurth" realmName="Eurth" />);
    const flags = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(flags).toEqual(["https://img.example/flag.png"]);
    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("leaves the founder out for a staff-run realm and keeps the realm link before the overview loads", () => {
    mockQueries.overview = { data: overview({ founder: null, officers: [] }) };
    const run = render(<AdvertRailPanel realmSlug="eurth" realmName="Eurth" />);
    expect(screen.queryByText("Founder")).toBeNull();
    expect(screen.getByRole("link", { name: "Open the realm page" })).toBeInTheDocument();
    run.unmount();
    mockQueries.overview = { isLoading: true };
    render(<AdvertRailPanel realmSlug="eurth" realmName="Eurth" />);
    expect(screen.getByRole("heading", { name: "About Eurth" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the realm page" })).toBeInTheDocument();
  });
});

describe("AdvertLockButton", () => {
  it("offers Lock with a visible label", () => {
    render(<AdvertLockButton threadId="t_ad" />);
    expect(screen.getByRole("button", { name: "Lock advert" })).toHaveTextContent("Lock advert");
  });

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

  it("is an icon button with the same accessible name and no visible text in a compact header", () => {
    render(<AdvertLockButton threadId="t_ad" iconOnly />);
    const button = screen.getByRole("button", { name: "Lock advert" });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("keeps a touch-sized target", () => {
    render(<AdvertLockButton threadId="t_ad" />);
    expect(screen.getByRole("button", { name: "Lock advert" }).className).toContain(
      "pointer-coarse:min-h-11"
    );
  });
});
