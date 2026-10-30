/**
 * The league page masthead links the league's wiki article when the owner set one in the settings, and shows
 * nothing in its place when none is set.
 */
import { render, screen } from "@testing-library/react";
import { LeagueMasthead } from "~/components/sports/league/LeagueMasthead";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";

const theme = { name: "Football", badgeClass: "", federationShort: "IFF" } as never;
const masthead = (wikiSlug: string | null) => (
  <LeagueMasthead
    league={{ id: "l1", name: "Liga Ixnay", wikiSlug }}
    archetypeLabel="Domestic league"
    sportTheme={theme}
  />
);

describe("LeagueMasthead wiki link", () => {
  it("links the league's wiki article when a slug is set", () => {
    render(masthead("Liga_Ixnay"));
    expect(screen.getByRole("link", { name: "Wiki article" })).toHaveAttribute(
      "href",
      titleToWikiOSRoute("Liga_Ixnay")
    );
  });

  it("shows no wiki link without a slug", () => {
    render(masthead(null));
    expect(screen.queryByRole("link", { name: "Wiki article" })).toBeNull();
  });
});
