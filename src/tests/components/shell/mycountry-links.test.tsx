/** The MyCountry sidebar row carries the public profile and editor buttons once the user's country is known. */
import { render, screen } from "@testing-library/react";
import { SourceList } from "~/components/shell/SourceList";
import { getApp } from "~/lib/navigation/app-sections";
import { stateLeaders } from "~/components/country-profile/derive";

const list = {
  pathname: "/dashboard",
  searchParams: null,
  apps: [getApp("mycountry")],
  expanded: new Set<string>(),
  onToggle: () => {},
  badges: {},
};

describe("MyCountry sidebar links", () => {
  it("links the public profile and the editor", () => {
    render(<SourceList {...list} countryHref="/countries/caphiria" />);
    expect(screen.getByRole("link", { name: "Public profile" })).toHaveAttribute(
      "href",
      "/countries/caphiria"
    );
    expect(screen.getByRole("link", { name: "Editor" })).toHaveAttribute(
      "href",
      "/mycountry/editor"
    );
  });

  it("takes the expand chevron's place outside MyCountry", () => {
    render(<SourceList {...list} countryHref="/countries/caphiria" />);
    expect(screen.queryByRole("button", { name: "Expand MyCountry" })).toBeNull();
  });

  it("shows neither without a country, and keeps the chevron", () => {
    render(<SourceList {...list} />);
    expect(screen.queryByRole("link", { name: "Public profile" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Editor" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expand MyCountry" })).toBeInTheDocument();
  });
});

describe("stateLeaders", () => {
  const leaders = [{ title: "Imperator", name: "Aurelia" }];

  it("prefers the government record's offices", () => {
    const government = {
      name: "Imperial Government",
      type: "Empire",
      headOfState: "Aurelia",
      headOfGovernment: null,
      legislature: null,
      executive: "Senate",
      judiciary: null,
      departments: [],
    };
    expect(stateLeaders({ government }, { leaders })).toEqual([
      { role: "Head of state", name: "Aurelia" },
      { role: "Executive", name: "Senate" },
    ]);
  });

  it("falls back to the infobox leaders", () => {
    expect(stateLeaders({ government: null }, { leaders })).toEqual([
      { role: "Imperator", name: "Aurelia" },
    ]);
  });
});
