import { render, screen } from "@testing-library/react";
import { RealmMapFace } from "~/components/realms/RealmMapFace";
import type { CardRealmBadge } from "~/lib/cards/face/types";

const mockUseQuery = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      mapFace: {
        useQuery: (
          input: { realmSlug: string },
          options: { enabled: boolean; staleTime: number }
        ) => mockUseQuery(input, options),
      },
    },
  },
}));

const realm: CardRealmBadge = {
  id: "r1",
  slug: "eurth",
  name: "Eurth",
  crestUrl: null,
  isSystem: false,
};

const face = {
  viewBox: "0 0 1500 625",
  land: "M0 0L10 0L10 10Z",
  open: "M20 20L30 20L30 30Z",
  claimed: "M40 40L50 40L50 50Z",
  other: "",
};

describe("RealmMapFace", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("shows the banner and skips the map query when a banner is set", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(<RealmMapFace realm={realm} bannerUrl="https://img.test/b.png" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://img.test/b.png");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(mockUseQuery).toHaveBeenCalledWith(
      { realmSlug: "eurth" },
      expect.objectContaining({ enabled: false })
    );
  });

  it("draws open, claimed and land paths from the face", () => {
    mockUseQuery.mockReturnValue({ data: face, isLoading: false });
    const { container } = render(<RealmMapFace realm={realm} bannerUrl={null} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe(face.viewBox);
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    for (const status of ["open", "claimed", "land"]) {
      expect(container.querySelectorAll(`path[data-status="${status}"]`)).toHaveLength(1);
    }
    expect(container.querySelector('path[data-status="other"]')).toBeNull();
  });

  it("falls back to the crest when the face is null", () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
    const { container } = render(<RealmMapFace realm={realm} bannerUrl={null} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText("E").closest(".bg-tint-fill")).not.toBeNull();
  });

  it("without a crest the fallback is the plain tint field", () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
    const { container } = render(<RealmMapFace realm={realm} bannerUrl={null} showCrest={false} />);
    expect(screen.queryByText("E")).toBeNull();
    expect(container.querySelector(".bg-tint-fill")).not.toBeNull();
  });

  it("uses a DOM-safe pattern id", () => {
    mockUseQuery.mockReturnValue({ data: face, isLoading: false });
    const { container } = render(<RealmMapFace realm={realm} bannerUrl={null} />);
    const fill = container.querySelector('path[data-status="open"]')?.getAttribute("fill");
    expect(fill).toMatch(/^url\(#[A-Za-z0-9_-]+\)$/);
    const id = /#([^)]+)\)/.exec(fill ?? "")?.[1];
    expect(container.querySelector(`pattern[id="${id}"]`)).not.toBeNull();
  });

  it("loads the crest emblem without a referrer", () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
    const { container } = render(
      <RealmMapFace
        realm={{ ...realm, crestUrl: "https://eurth.org/crest.png" }}
        bannerUrl={null}
      />
    );
    expect(container.querySelector("img")?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });
});
