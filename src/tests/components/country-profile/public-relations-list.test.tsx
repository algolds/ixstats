/** The Foreign affairs sheet's lists: flags resolve under the base path and fall back to an initial. */
import { fireEvent, render, screen } from "@testing-library/react";
import { PublicRelationsList } from "~/components/country-profile/factbook/PublicRelationsList";

jest.mock("~/lib/base-path", () => ({
  ...jest.requireActual("~/lib/base-path"),
  assetUrl: (url: string | null) => (url ? `/projects/ixstates${url}` : null),
}));

const world = {
  relations: [
    {
      id: "r1",
      countryId: "m",
      name: "Maresteyn",
      flagUrl: "/images/uploads/maresteyn.png",
      relationship: "FRIENDLY",
      strength: 50,
      treaties: [],
    },
  ],
  embassies: [],
};

describe("PublicRelationsList flags", () => {
  it("serves an uploaded flag under the base path", () => {
    const { container } = render(<PublicRelationsList world={world} />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/projects/ixstates/images/uploads/maresteyn.png"
    );
  });

  it("falls back to the country's initial when the flag fails to load", () => {
    const { container } = render(<PublicRelationsList world={world} />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("filters between relations and embassies when both exist", () => {
    const both = {
      relations: [
        {
          id: "r1",
          countryId: "m",
          name: "Maresteyn",
          flagUrl: null,
          relationship: "ALLIED",
          strength: 85,
          treaties: ["Mutual Defense Pact"],
        },
      ],
      embassies: [
        {
          id: "e1",
          countryId: "u",
          countryName: "Urcea",
          countrySlug: "urcea",
          flagUrl: null,
          role: "host" as const,
          status: "ACTIVE",
          level: 2,
        },
      ],
    };
    render(<PublicRelationsList world={both} />);
    expect(screen.getByText("1 treaty · 85% strength")).toBeInTheDocument();
    expect(screen.getByText("Maresteyn")).toBeInTheDocument();
    expect(screen.getByText("Urcea")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Embassies · 1/ }));
    expect(screen.queryByText("Maresteyn")).toBeNull();
    expect(screen.getByText("Urcea")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Relations · 1/ }));
    expect(screen.getByText("Maresteyn")).toBeInTheDocument();
    expect(screen.queryByText("Urcea")).toBeNull();
  });
});
