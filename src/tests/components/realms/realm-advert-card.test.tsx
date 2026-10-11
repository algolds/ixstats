import React from "react";
import { render, screen, within } from "@testing-library/react";

let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams }));

import { RealmCard } from "~/components/realms/RealmCard";
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
  mockParams = new URLSearchParams();
});

describe("the advert variant", () => {
  it("shows the realm's identity: banner, emblem, name, counts, description and tags", () => {
    const { container } = renderAdvert();
    const card = screen.getByRole("region", { name: "Eurth advert" });
    expect(card).toHaveAttribute("data-content", "entity");
    expect(screen.getByRole("link", { name: "Eurth" })).toHaveAttribute("href", "/r/eurth");
    expect(card).toHaveTextContent("9 members · 12 nations");
    expect(card).toHaveTextContent("A modern world of diplomacy.");
    const tags = within(screen.getByRole("list", { name: "Tags" })).getAllByRole("listitem");
    expect(tags.map((t) => t.textContent)).toEqual(["Modern", "Roleplay"]);
    const sources = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(sources).toEqual(["https://img.example/banner.png", "https://img.example/emblem.png"]);
  });

  it("offers Join, the board and the rules, each a comfortable touch target", () => {
    renderAdvert();
    const join = screen.getByRole("link", { name: "Join" });
    expect(join).toHaveAttribute("href", "/r/eurth");
    expect(screen.getByRole("link", { name: "Visit the board" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth"
    );
    expect(screen.getByRole("link", { name: "Rules" })).toHaveAttribute("href", "/r/eurth/rules");
    for (const name of ["Join", "Visit the board", "Rules"]) {
      expect(screen.getByRole("link", { name })).toHaveClass("pointer-coarse:min-h-11");
    }
  });

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

  it("drops a blank or over-long invite handle", () => {
    mockParams = new URLSearchParams([["via", "x".repeat(101)]]);
    const long = renderAdvert();
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/r/eurth");
    long.unmount();
    mockParams = new URLSearchParams([["via", "   "]]);
    renderAdvert();
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/r/eurth");
  });

  it("says the realm is closed instead of offering Join when it takes no new nations", () => {
    renderAdvert(overview({ realm: { claimsOpen: false, status: "archived" } }));
    expect(screen.queryByRole("link", { name: "Join" })).toBeNull();
    expect(screen.getByText("Closed to new nations")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visit the board" })).toBeInTheDocument();
  });

  it("tells a viewer who already holds a nation there, and offers no Join", () => {
    renderAdvert(
      overview({ viewer: { ownedNations: [{ id: "c1", name: "Aria", slug: "aria" }] } })
    );
    expect(screen.getByText("You are in this realm")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Join" })).toBeNull();
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

  it("still offers Join to a signed-out viewer (the realm page asks them to sign in)", () => {
    renderAdvert(overview({ viewer: { signedIn: false } }));
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/r/eurth");
  });

  it("shows no online figure: the advert does not join the board's presence room", () => {
    renderAdvert();
    expect(screen.getByRole("region")).not.toHaveTextContent("online");
  });

  it("falls back from the emblem to the thumbnail to the realm mark", () => {
    const thumb = renderAdvert(
      overview({
        realm: { bannerUrl: null, emblemUrl: null, thumbnail: "https://img.example/thumb.png" },
      })
    );
    expect(thumb.container.querySelector("img")).toHaveAttribute(
      "src",
      "https://img.example/thumb.png"
    );
    thumb.unmount();
    const none = renderAdvert(
      overview({ realm: { bannerUrl: null, emblemUrl: null, thumbnail: null } })
    );
    expect(none.container.querySelector("img")).toBeNull();
    expect(none.container.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Eurth" })).toBeInTheDocument();
  });

  it("copes with a realm that has no description, tags or rules", () => {
    renderAdvert(overview({ realm: { description: null, tags: [] }, rules: null }));
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Rules" })).toBeNull();
    expect(screen.getByRole("link", { name: "Join" })).toBeInTheDocument();
  });

  it("uses the singular for one member and one nation", () => {
    renderAdvert(overview({ stats: { nations: 1, claimedNations: 1 } }));
    expect(screen.getByRole("region")).toHaveTextContent("1 member · 1 nation");
  });
});

describe("RealmCard dispatches on its variant", () => {
  it("renders the advert for variant advert and the directory card otherwise", () => {
    const advert = render(<RealmCard variant="advert" overview={overview()} />);
    expect(screen.getByRole("region", { name: "Eurth advert" })).toHaveTextContent("9 members");
    advert.unmount();
    const directory = render(
      <ul>
        <RealmCard
          realm={
            {
              id: "r1",
              slug: "eurth",
              name: "Eurth",
              description: null,
              thumbnail: null,
              bannerUrl: null,
              tags: [],
              foundedAt: new Date(),
              nationCount: 2,
              openNationCount: 0,
              openNationPageCount: 0,
              myNationCount: 0,
              maxNationsPerUser: 1,
              board: { recentPosts: 0, lastPostAt: null },
            } as never
          }
        />
      </ul>
    );
    expect(directory.container.querySelector("li")).not.toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });
});
