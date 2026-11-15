/** The Factbook's still map crop: the country outline linking to the Map tab, framed per block. */
import { render, screen } from "@testing-library/react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";

const bundle = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: { countryGeo: { getCountryGeoBundle: { useQuery: () => ({ data: bundle() }) } } },
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { MapCrop } from "~/components/country-profile/factbook/MapCrop";

const LAYER = {
  countryId: "c1",
  slug: "caphiria",
  land: {
    hasGeometry: true,
    cities: [
      { id: "v", name: "Venceia", isCapital: true, coordinates: [18, 42], population: 1 },
      { id: "a", name: "Aurelia", isCapital: false, coordinates: [12, 41], population: 2 },
    ],
  },
  world: { embassies: [{ countryName: "Urcea" }] },
} as unknown as CountryProfileLayer;

const OUTLINE = {
  geometry: {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [10, 40],
          [20, 40],
          [20, 44],
          [10, 40],
        ],
      ],
    },
  },
  boundingBox: [10, 40, 20, 44],
  neighbors: [
    { featureId: "urcea", displayName: "Urcea", centroidLng: 25, centroidLat: 42 },
    { featureId: "x", displayName: "Xland", centroidLng: 5, centroidLat: 42 },
  ],
};

describe("MapCrop", () => {
  it("draws the outline (stored as a Feature) inside a link to the Map tab", () => {
    bundle.mockReturnValue(OUTLINE);
    const { container } = render(<MapCrop kind="economy" layer={LAYER} />);
    expect(screen.getByRole("link", { name: "Open the map of its cities" })).toHaveAttribute(
      "href",
      "/countries/caphiria/map"
    );
    expect(container.querySelector("path")?.getAttribute("d")).toMatch(/^M10,-40L20,-40/);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  it("marks neighbours on Foreign affairs, embassy partners in the tint", () => {
    bundle.mockReturnValue(OUTLINE);
    const { container } = render(<MapCrop kind="foreign" layer={LAYER} />);
    const dots = [...container.querySelectorAll("circle")].map((c) => c.getAttribute("class"));
    expect(dots).toEqual(["fill-tint", "fill-label-tertiary"]);
  });

  it("renders nothing without an outline", () => {
    bundle.mockReturnValue({ geometry: null, boundingBox: null, neighbors: [] });
    const { container } = render(<MapCrop kind="state" layer={LAYER} />);
    expect(container).toBeEmptyDOMElement();
  });
});
