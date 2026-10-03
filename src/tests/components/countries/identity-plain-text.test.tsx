import { render, screen } from "@testing-library/react";

jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/components/achievements/FloatingRibbonRack", () => ({
  CountryOwnerRibbonRack: () => null,
}));

import { CountryHero } from "~/components/country-profile/CountryHero";
import { IdentityRows } from "~/components/country-profile/ProfileFacts";
import type { ProfileIdentity } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";

const RAW =
  'A Portuguesa, Imnu ali Ripublică, "Hymn of the Republic"<div style="padding-top:0.5em;"></div>';
const CLEAN = 'A Portuguesa, Imnu ali Ripublică, "Hymn of the Republic"';

describe("wiki infobox identity fields render as plain text", () => {
  it("CountryHero strips markup from the anthem fact and the motto", () => {
    render(
      <CountryHero
        name="Pelaxia"
        flagUrl={null}
        motto={'<i>Unity</i> and <span class="x">Strength</span>'}
        facts={[{ label: "Anthem", value: RAW }]}
      />
    );
    expect(screen.getByText(CLEAN)).toBeInTheDocument();
    expect(screen.queryByText(/<div/)).not.toBeInTheDocument();
    expect(screen.getByText(/Unity and Strength/)).toBeInTheDocument();
  });

  it("IdentityRows strips markup from every identity row", () => {
    const identity = {
      officialName: 'Republic of Pelaxia<div style="x"></div>',
      capital: "<b>Vila Nova</b>",
      anthem: RAW,
      governmentType: null,
      languages: null,
      currency: null,
      demonym: null,
      leaders: [],
    } as unknown as ProfileIdentity;
    const { container } = render(<IdentityRows identity={identity} />);
    expect(screen.getByText(CLEAN)).toBeInTheDocument();
    expect(screen.getByText("Vila Nova")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("&lt;");
  });
});
