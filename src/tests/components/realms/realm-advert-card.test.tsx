import "react";
import { render, screen } from "@testing-library/react";

let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams }));

const mockUseRealmBoardLive = jest.fn();
jest.mock("~/hooks/useRealmBoardLive", () => ({
  useRealmBoardLive: (...args: never[]) => mockUseRealmBoardLive(...args),
}));
import { RealmAdvertCard } from "~/components/realms/RealmAdvertCard";

function overview(
  over: { realm?: object; stats?: object; rules?: object | null; viewer?: object } = {}
) {
  return {
    realm: {
      id: "r1",
      slug: "eurth",
      name: "Eurth",
      description: "A modern world of diplomacy.",
      thumbnail: null,
      bannerUrl: "https://img.example/banner.png",
      emblemUrl: "https://img.example/emblem.png",
      tags: ["Modern", "Roleplay"],
      status: "active",
      foundedAt: new Date("2025-01-01"),
      claimsOpen: true,
      ...over.realm,
    },
    stats: { nations: 12, claimedNations: 9, population: 1_000_000, ...over.stats },
    rules:
      over.rules === undefined
        ? { html: "<p>Be kind</p>", summary: "Be kind", updatedAt: new Date() }
        : over.rules,
    viewer: {
      signedIn: true,
      powers: [],
      isFounder: false,
      canManage: false,
      ownedNations: [],
      ...over.viewer,
    },
  } as never;
}

const renderAdvert = (data = overview()) => render(<RealmAdvertCard overview={data} />);

beforeEach(() => {
  mockUseRealmBoardLive.mockClear();
  mockParams = new URLSearchParams();
});

describe("the advert variant", () => {
  it("carries the invite handle on Join, encoded", () => {
    mockParams = new URLSearchParams("via=heku");
    const first = renderAdvert();
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/r/eurth?via=heku");
    first.unmount();
    mockParams = new URLSearchParams([["via", "a b&c"]]);
    renderAdvert();
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute(
      "href",
      "/r/eurth?via=a%20b%26c"
    );
  });
  it("never names the viewer's nations or powers on the card", () => {
    renderAdvert(
      overview({
        viewer: {
          ownedNations: [{ id: "c1", name: "Aria", slug: "aria" }],
          powers: ["appearance"],
          canManage: true,
        },
      })
    );
    const card = screen.getByRole("region");
    expect(card).not.toHaveTextContent("Aria");
    expect(card).not.toHaveTextContent("appearance");
  });
});
