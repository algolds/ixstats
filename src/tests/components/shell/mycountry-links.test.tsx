/** The MyCountry app lists Public profile, Country editor, and Map editor rows once the user's country is known. */
import { render, screen } from "@testing-library/react";
import { SourceList } from "~/components/shell/SourceList";
import { TabBar } from "~/components/shell/TabBar";
import { getApp, getVisibleApps, withCountryRows } from "~/lib/navigation/app-sections";
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
  it("lists the public profile, country editor, and map editor as MyCountry rows", () => {
    render(<SourceList {...list} pathname="/mycountry" countryHref="/countries/caphiria" />);
    expect(screen.getByRole("link", { name: "Public profile" })).toHaveAttribute(
      "href",
      "/countries/caphiria"
    );
    expect(screen.getByRole("link", { name: "Country editor" })).toHaveAttribute(
      "href",
      "/mycountry/editor"
    );
    expect(screen.getByRole("link", { name: "Map editor" })).toHaveAttribute(
      "href",
      "/mycountry/map-editor"
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
    expect(screen.getByRole("link", { name: "Country editor" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Map editor" })).toBeInTheDocument();
  });

  it("keeps the expand chevron outside MyCountry", () => {
    render(<SourceList {...list} countryHref="/countries/caphiria" />);
    expect(screen.getByRole("button", { name: "Expand MyCountry" })).toBeInTheDocument();
  });

  it.each([undefined, ""])(
    "lists none of the nation rows without a country (%p)",
    (countryHref) => {
      render(<SourceList {...list} pathname="/mycountry" countryHref={countryHref} />);
      expect(screen.queryByRole("link", { name: "Public profile" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Country editor" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Map editor" })).toBeNull();
    }
  );

  it("leaves the sections to the command ribbon in the page", () => {
    render(<SourceList {...list} pathname="/mycountry" countryHref="/countries/caphiria" />);
    for (const name of ["Overview", "Directives", "Economy", "Diplomacy", "Politics", "Defense"]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
  });

  it("withCountryRows leaves other apps alone", () => {
    const apps = [getApp("vault"), getApp("mycountry")];
    expect(withCountryRows(apps, undefined)).toBe(apps);
    expect(withCountryRows(apps, "/countries/x")[0]).toBe(apps[0]);
  });

  it("uses contextual backHref for 'All apps' when viewing Settings or Admin", () => {
    render(
      <SourceList {...list} apps={[getApp("settings")]} pathname="/settings" backHref="/vault" />
    );
    expect(screen.getByRole("link", { name: "All apps" })).toHaveAttribute("href", "/vault");
  });
});

describe("TabBar badges and overflow dot", () => {
  it("renders unread count on primary tabs and a pending dot on More when a non-primary app has a badge", () => {
    const apps = getVisibleApps({ signedIn: true, isAdmin: false });
    const { container } = render(
      <TabBar
        pathname="/dashboard"
        searchParams={null}
        apps={apps}
        expanded={new Set()}
        onToggle={() => {}}
        badges={{
          "messages-unread": { kind: "count", value: 4 },
          "daily-reward": { kind: "action", label: "New" },
        }}
      />
    );

    const badge = container.querySelector('[data-slot="tab-bar-badge"]');
    expect(badge?.textContent).toBe("4");
    expect(screen.getByRole("button", { name: "More, updates available" })).toBeInTheDocument();
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
