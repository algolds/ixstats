/**
 * The league page masthead links the league's wiki article when the owner set one in the settings, and shows
 * nothing in its place when none is set. Beside the link, the league's manager gets "Publish to wiki".
 */
interface PublishOptions {
  onSuccess: (result: { success: boolean }) => void;
  onError: (err: { message: string }) => void;
}
let publishOptions: PublishOptions | undefined;
const mockMutate = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    sports: {
      publishStandingsToWiki: {
        useMutation: (options: PublishOptions) => {
          publishOptions = options;
          return { mutate: mockMutate, isPending: false };
        },
      },
    },
  },
}));
const mockNotify = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));

import { fireEvent, render, screen } from "@testing-library/react";
import { LeagueMasthead } from "~/components/sports/league/LeagueMasthead";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";

const theme = { name: "Football", badgeClass: "", federationShort: "IFF" } as never;
const masthead = (wikiSlug: string | null, canManageLeague = false) => (
  <LeagueMasthead
    league={{ id: "l1", name: "Liga Ixnay", wikiSlug }}
    archetypeLabel="Domestic league"
    sportTheme={theme}
    canManageLeague={canManageLeague}
  />
);

beforeEach(() => {
  publishOptions = undefined;
  mockMutate.mockReset();
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

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

describe("LeagueMasthead publish to wiki", () => {
  const publishButton = () => screen.queryByRole("button", { name: "Publish to wiki" });

  it("shows the league's manager the button beside the wiki link and publishes the league", () => {
    render(masthead("Liga_Ixnay", true));
    fireEvent.click(publishButton()!);
    expect(mockMutate).toHaveBeenCalledWith({ leagueId: "l1" });
  });

  it("hides the button from anyone who does not manage the league", () => {
    render(masthead("Liga_Ixnay", false));
    expect(publishButton()).toBeNull();
  });

  it("hides the button when the league has no wiki article", () => {
    render(masthead(null, true));
    expect(publishButton()).toBeNull();
  });

  it("says when the standings were published, and when the article changed meanwhile", () => {
    render(masthead("Liga_Ixnay", true));
    publishOptions!.onSuccess({ success: true });
    expect(mockNotify.success).toHaveBeenCalledWith("Standings published to the wiki");
    publishOptions!.onSuccess({ success: false });
    expect(mockNotify.warning).toHaveBeenCalledWith(
      "The article changed while you were publishing. Try again."
    );
  });

  it("shows the server's reason when publishing is refused", () => {
    render(masthead("Liga_Ixnay", true));
    publishOptions!.onError({ message: "This league has no standings to publish yet." });
    expect(mockNotify.error).toHaveBeenCalledWith("This league has no standings to publish yet.");
  });
});
