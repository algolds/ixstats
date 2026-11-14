/**
 * MyLeague's team import takes a sister wiki's page: the picked wiki reaches `sports.previewWikiTeams`, Wiki stays
 * the default, a switched-off IIWiki cannot be picked, and a wiki that cannot answer shows its own words.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { IiwikiAvailability } from "~/lib/wiki-os/wiki-source-availability";

interface PreviewState {
  data?: Array<{ name: string; wikiSlug: string | null; wikiSource?: "ixwiki" | "iiwiki" | null }>;
  isError?: boolean;
  isSuccess?: boolean;
  error?: { message: string; data: { code: string } } | null;
}
const mockPreviewInputs: Array<{ input: { wikiSlug: string; wiki: string }; enabled: boolean }> =
  [];
let mockPreview: PreviewState = {};
let mockAvailability: Partial<IiwikiAvailability> | undefined;

jest.mock("~/trpc/react", () => ({
  api: {
    sports: {
      previewWikiTeams: {
        useQuery: (input: { wikiSlug: string; wiki: string }, options: { enabled: boolean }) => {
          mockPreviewInputs.push({ input, enabled: options.enabled });
          return { isFetching: false, ...mockPreview };
        },
      },
    },
    wikios: {
      iiwikiAvailability: { useQuery: () => ({ data: mockAvailability }) },
    },
  },
}));

import { LeagueWikiImport } from "~/components/sports/league/LeagueWikiImport";

function renderImport(wikiSlug = "Varro_League") {
  return render(
    <LeagueWikiImport
      wikiSlug={wikiSlug}
      onWikiSlugChange={() => undefined}
      importedCount={null}
      minTeams={2}
      maxTeams={20}
      onImport={() => undefined}
      onClear={() => undefined}
    />
  );
}

const lastEnabledInput = () => mockPreviewInputs.filter((call) => call.enabled).at(-1)?.input;

beforeEach(() => {
  mockPreviewInputs.length = 0;
  mockPreview = {};
  mockAvailability = { imports: null };
});

describe("LeagueWikiImport", () => {
  it("reads the league's own article on Wiki by default", () => {
    renderImport();
    expect(screen.getByRole("radio", { name: "Wiki" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Import teams" }));

    expect(lastEnabledInput()).toEqual({ wikiSlug: "Varro_League", wiki: "ixwiki" });
  });

  it("sends the picked sister wiki and its page to the server and preserves team wikiSource on import", () => {
    const onImport = jest.fn();
    mockPreview = {
      isSuccess: true,
      data: [
        { name: "Varro", wikiSlug: "FC_Varro", wikiSource: "iiwiki" },
        { name: "Lest", wikiSlug: "Lest_HC", wikiSource: "iiwiki" },
      ],
    };
    render(
      <LeagueWikiImport
        wikiSlug=""
        onWikiSlugChange={() => undefined}
        importedCount={null}
        minTeams={2}
        maxTeams={20}
        onImport={onImport}
        onClear={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));
    fireEvent.change(screen.getByLabelText("IIWiki article"), {
      target: { value: "Varro League (hockey)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import teams" }));

    expect(lastEnabledInput()).toEqual({ wikiSlug: "Varro_League_(hockey)", wiki: "iiwiki" });
    expect(screen.queryByText(/come as names only/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use 2 teams" }));
    expect(onImport).toHaveBeenCalledWith(
      [
        { name: "Varro", wikiSlug: "FC_Varro", wikiSource: "iiwiki" },
        { name: "Lest", wikiSlug: "Lest_HC", wikiSource: "iiwiki" },
      ],
      { wikiSlug: "Varro_League_(hockey)", wikiSource: "iiwiki" }
    );
  });

  it("cannot pick IIWiki while it is switched off, and says so", () => {
    mockAvailability = { imports: "disabled" };
    renderImport();

    expect(screen.getByRole("radio", { name: "IIWiki" })).toBeDisabled();
    expect(screen.getByText("IIWiki is switched off for now.")).toBeInTheDocument();
  });

  it("shows a wiki's outage in its own words instead of a generic failure", () => {
    mockPreview = {
      isError: true,
      error: { message: "IIWiki is switched off for now.", data: { code: "SERVICE_UNAVAILABLE" } },
    };
    renderImport();
    fireEvent.click(screen.getByRole("button", { name: "Import teams" }));

    expect(screen.getByRole("alert")).toHaveTextContent("IIWiki is switched off for now.");
  });
});
