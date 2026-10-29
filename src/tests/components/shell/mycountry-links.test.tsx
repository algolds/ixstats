/** The MyCountry app lists Public profile and Editor rows once the user's country is known. */
import { render, screen } from "@testing-library/react";
import { SourceList } from "~/components/shell/SourceList";
import { getApp, withCountryRows } from "~/lib/navigation/app-sections";
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
  it("lists the public profile and the editor as MyCountry rows", () => {
    render(<SourceList {...list} pathname="/mycountry" countryHref="/countries/caphiria" />);
    expect(screen.getByRole("link", { name: "Public profile" })).toHaveAttribute(
      "href",
      "/countries/caphiria"
    );
    expect(screen.getByRole("link", { name: "Editor" })).toHaveAttribute(
      "href",
      "/mycountry/editor"
    );
  });

  it("lists them in the collapsed rail's popover too", () => {
    render(
      <SourceList
        {...list}
        variant="popover"
        app={getApp("mycountry")}
        countryHref="/countries/caphiria"
      />
    );
    expect(screen.getByRole("link", { name: "Editor" })).toBeInTheDocument();
  });

  it("keeps the expand chevron outside MyCountry", () => {
    render(<SourceList {...list} countryHref="/countries/caphiria" />);
    expect(screen.getByRole("button", { name: "Expand MyCountry" })).toBeInTheDocument();
  });

  it.each([undefined, ""])("lists neither without a country (%p)", (countryHref) => {
    render(<SourceList {...list} pathname="/mycountry" countryHref={countryHref} />);
    expect(screen.queryByRole("link", { name: "Public profile" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Editor" })).toBeNull();
  });

  it("withCountryRows leaves other apps alone", () => {
    const apps = [getApp("vault"), getApp("mycountry")];
    expect(withCountryRows(apps, undefined)).toBe(apps);
    expect(withCountryRows(apps, "/countries/x")[0]).toBe(apps[0]);
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
