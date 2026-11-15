/**
 * The map editor's wiki link wizard searches the wiki the editor picks among the realm's own (Ixnay: Wiki, then
 * IIWiki): the pick reaches `geoWiki.searchWikiPages`, the linked page's infobox is read on the wiki it was found on,
 * a switched-off IIWiki cannot be picked, and a search in a wiki that cannot answer says why instead of "no pages".
 */
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { IiwikiAvailability } from "~/lib/wiki-os/wiki-source-availability";

type SearchInput = { query: string; wiki?: string };
type SearchState = {
  data?: { wikiSource: string | null; results: Array<{ title: string; description: string }> };
  error?: { message: string; data: { code: string } } | null;
};
const mockSearchInputs: SearchInput[] = [];
const mockInfoboxInputs: Array<{ pageTitle: string; wiki?: string }> = [];
let mockSearch: SearchState = {};
let mockAvailability: Partial<IiwikiAvailability> | undefined;
let mockRealmWikis: string[] | undefined = ["ixwiki", "iiwiki"];

jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/trpc/react", () => ({
  api: {
    geoWiki: {
      wikiSources: { useQuery: () => ({ data: mockRealmWikis }) },
      searchWikiPages: {
        useQuery: (input: SearchInput, options: { enabled: boolean }) => {
          if (options.enabled) mockSearchInputs.push(input);
          return options.enabled ? { isLoading: false, ...mockSearch } : { isLoading: false };
        },
      },
      parseWikiInfobox: {
        useQuery: (input: { pageTitle: string; wiki?: string }, options: { enabled: boolean }) => {
          if (options.enabled) mockInfoboxInputs.push(input);
          return { data: undefined, isLoading: false, error: null };
        },
      },
    },
    wikios: {
      iiwikiAvailability: { useQuery: () => ({ data: mockAvailability }) },
    },
  },
}));

import { WikiLinkWizard } from "~/components/maps/editor/WikiLinkWizard";

function Harness() {
  return <WikiLinkWizard onChange={() => undefined} placeholder="Search wiki to link..." />;
}

const type = (query: string) =>
  fireEvent.change(screen.getByPlaceholderText("Search wiki to link..."), {
    target: { value: query },
  });

beforeEach(() => {
  mockSearchInputs.length = 0;
  mockInfoboxInputs.length = 0;
  mockSearch = {};
  mockAvailability = { country: null };
  mockRealmWikis = ["ixwiki", "iiwiki"];
});

describe("WikiLinkWizard wiki source", () => {
  it("searches Wiki by default, and the picked IIWiki once picked", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "Wiki" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("radio", { name: "AltHistory Wiki" })).toBeNull();

    type("Lucrecia");
    expect(mockSearchInputs.at(-1)).toMatchObject({ query: "Lucrecia", wiki: "ixwiki" });

    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));
    expect(mockSearchInputs.at(-1)).toMatchObject({ query: "Lucrecia", wiki: "iiwiki" });
  });

  it("reads the linked page's infobox on the wiki it was found on", () => {
    mockSearch = {
      data: { wikiSource: "iiwiki", results: [{ title: "Lucrecia", description: "" }] },
    };
    const seenChanges: Array<[string | undefined, string | null | undefined]> = [];
    function TrackingLink() {
      const [title, setTitle] = useState<string | undefined>();
      return (
        <WikiLinkWizard
          value={title}
          onChange={(next, source) => {
            seenChanges.push([next, source]);
            setTitle(next);
          }}
          placeholder="Search wiki to link..."
        />
      );
    }

    render(<TrackingLink />);
    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));
    type("Lucrecia");

    fireEvent.click(screen.getByRole("button", { name: /Lucrecia/ }));

    expect(seenChanges.at(-1)).toEqual(["Lucrecia", "iiwiki"]);
    expect(mockInfoboxInputs.at(-1)).toMatchObject({ pageTitle: "Lucrecia", wiki: "iiwiki" });
    expect(screen.getByTitle("Open on wiki")).toHaveAttribute(
      "href",
      expect.stringContaining("/wiki/Lucrecia?source=iiwiki")
    );

    fireEvent.click(screen.getByTitle("Unlink wiki page"));
    expect(seenChanges.at(-1)).toEqual([undefined, null]);
  });

  it("uses a stored wikiSource prop for the open link and infobox lookup", () => {
    render(
      <WikiLinkWizard
        value="Lucrecia"
        wikiSource="iiwiki"
        onChange={() => undefined}
        placeholder="Search wiki to link..."
      />
    );

    expect(screen.getByTitle("Open on wiki")).toHaveAttribute(
      "href",
      expect.stringContaining("/wiki/Lucrecia?source=iiwiki")
    );

    fireEvent.click(screen.getByTitle("View infobox data"));
    expect(mockInfoboxInputs.at(-1)).toMatchObject({ pageTitle: "Lucrecia", wiki: "iiwiki" });
  });

  it("cannot pick IIWiki while it is switched off, and says so", () => {
    mockAvailability = { country: "disabled" };
    render(<Harness />);

    expect(screen.getByRole("radio", { name: "IIWiki" })).toBeDisabled();
    expect(screen.getByText("IIWiki is switched off for now.")).toBeInTheDocument();
  });

  it("says why a search in a wiki that cannot answer found nothing", () => {
    mockRealmWikis = ["iiwiki"];
    mockAvailability = { country: "disabled" };
    mockSearch = {
      error: { message: "IIWiki is switched off for now.", data: { code: "SERVICE_UNAVAILABLE" } },
    };
    render(<Harness />);
    expect(screen.queryByRole("radiogroup")).toBeNull();

    type("Lucrecia");

    expect(mockSearchInputs.at(-1)).toMatchObject({ wiki: "iiwiki" });
    expect(screen.getByRole("alert")).toHaveTextContent("IIWiki is switched off for now.");
  });
});
