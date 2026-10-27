import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { RealmHeroMap } from "~/components/realms/RealmHeroMap";

const mockUseQuery = jest.fn((_input: { realmSlug: string }, _opts: { enabled: boolean }) => ({
  data: undefined,
}));

jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      mapGeo: {
        useQuery: (input: { realmSlug: string }, opts: { enabled: boolean }) =>
          mockUseQuery(input, opts),
      },
    },
  },
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/components/ui/view-transition", () => ({
  SharedElement: ({ name, children }: { name: string; children: ReactNode }) => (
    <div data-vt={name}>{children}</div>
  ),
}));
jest.mock("~/components/realms/RealmMapFace", () => ({
  RealmMapFace: ({ bannerUrl }: { bannerUrl: string | null }) => (
    <div data-testid="face">{bannerUrl ? `banner ${bannerUrl}` : "svg face"}</div>
  ),
}));
// MapLibre never loads in jsdom: the live layer stays hidden.
jest.mock("~/lib/maps/load-maplibre", () => ({ loadMaplibre: () => new Promise(() => {}) }));

const REALM = { id: "r1", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };

describe("RealmHeroMap", () => {
  beforeEach(() => {
    mockUseQuery.mockClear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("shows the banner alone and never asks for the map", () => {
    render(<RealmHeroMap realm={REALM} bannerUrl="/b.png" />);
    expect(screen.getByTestId("face")).toHaveTextContent("banner /b.png");
    expect(mockUseQuery.mock.calls.every(([, opts]) => !opts.enabled)).toBe(true);
    expect(screen.queryByText("Open full map")).not.toBeInTheDocument();
  });

  it("paints the SVG face as the shared element first", () => {
    const { container } = render(<RealmHeroMap realm={REALM} bannerUrl={null} />);
    expect(container.querySelector('[data-vt="realm-map-ixnay"]')).toHaveTextContent("svg face");
  });

  it("asks for the live map only once the browser is idle", () => {
    render(<RealmHeroMap realm={REALM} bannerUrl={null} />);
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      { realmSlug: "ixnay" },
      expect.objectContaining({ enabled: false })
    );
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockUseQuery).toHaveBeenLastCalledWith(
      { realmSlug: "ixnay" },
      expect.objectContaining({ enabled: true })
    );
  });
});
