/**
 * Founding a company from a wiki page takes a sister wiki's page: the picked wiki reaches
 * `exchange.previewWikiCompany` and the charter, Wiki stays the default, and a wiki that cannot answer is said in its
 * own words rather than breaking the sheet.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { IiwikiAvailability } from "~/lib/wiki-os/wiki-source-availability";

const mockPreviewFetch = jest.fn();
const mockFound = jest.fn();
const mockNotify = { success: jest.fn(), error: jest.fn() };
let mockAvailability: Partial<IiwikiAvailability> | undefined;

jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ exchange: { previewWikiCompany: { fetch: mockPreviewFetch } } }),
    exchange: {
      foundCompany: { useMutation: () => ({ mutate: mockFound, isPending: false }) },
    },
    wikios: {
      iiwikiAvailability: { useQuery: () => ({ data: mockAvailability }) },
    },
  },
}));

import { FoundCompanySheet } from "~/components/exchange/FoundCompanySheet";

// Radix Select measures its trigger; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const overview = {
  realmId: "ixnay",
  nations: [],
  realmNations: [],
  companies: [],
  companyRules: { activeCompanyCap: 3, charterFee: 100 },
} as never;

const preview = {
  wikiSource: "iiwiki",
  wikiSlug: "Vanguard_Aerospace",
  pageTitle: "Vanguard Aerospace",
  companyName: "Vanguard Aerospace",
  sectorKey: "industry",
  subIndustryKey: "defense_aerospace",
  taxonomyMatch: "matched",
  hqCountryId: null,
  hqCountryName: null,
  wikiData: {
    wikiSource: "iiwiki",
    wikiSlug: "Vanguard_Aerospace",
    pageTitle: "Vanguard Aerospace",
    logoUrl: null,
    motto: null,
    summary: null,
  },
};

function renderSheet() {
  return render(
    <FoundCompanySheet
      open
      onOpenChange={() => undefined}
      overview={overview}
      onDone={() => undefined}
    />
  );
}

async function importFrom(title: string) {
  fireEvent.change(screen.getByRole("textbox", { name: /article title or URL/ }), {
    target: { value: title },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Sync from/ }));
  });
}

beforeEach(() => {
  mockPreviewFetch.mockReset();
  mockFound.mockReset();
  mockNotify.success.mockReset();
  mockNotify.error.mockReset();
  mockAvailability = { imports: null };
});

describe("FoundCompanySheet wiki source", () => {
  it("reads Wiki by default", async () => {
    mockPreviewFetch.mockResolvedValue({ ...preview, wikiSource: "ixwiki" });
    renderSheet();
    expect(screen.getByRole("radio", { name: "Wiki" })).toHaveAttribute("aria-checked", "true");

    await importFrom("Vanguard Aerospace");

    expect(mockPreviewFetch).toHaveBeenCalledWith({
      wikiTitle: "Vanguard Aerospace",
      wiki: "ixwiki",
      realmId: "ixnay",
    });
  });

  it("sends the picked sister wiki to the preview and the charter, and links the page there", async () => {
    mockPreviewFetch.mockResolvedValue(preview);
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));

    await importFrom("Vanguard Aerospace");

    expect(mockPreviewFetch).toHaveBeenCalledWith(expect.objectContaining({ wiki: "iiwiki" }));
    expect(screen.getByRole("link", { name: /IIWiki: Vanguard Aerospace/ })).toHaveAttribute(
      "href",
      "/wiki/Vanguard_Aerospace?source=iiwiki"
    );

    fireEvent.submit(screen.getByRole("button", { name: /^Charter for/ }).closest("form")!);
    expect(mockFound).toHaveBeenCalledWith(
      expect.objectContaining({ wikiSlug: "Vanguard_Aerospace", wikiSource: "iiwiki" })
    );
  });

  it("says a switched-off IIWiki in its own words", async () => {
    mockPreviewFetch.mockRejectedValue(new Error("IIWiki is switched off for now."));
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "IIWiki" }));

    await importFrom("Vanguard Aerospace");

    expect(mockNotify.error).toHaveBeenCalledWith(
      "Could not import from IIWiki",
      "IIWiki is switched off for now."
    );
  });

  it("cannot pick IIWiki while its imports are switched off", () => {
    mockAvailability = { imports: "disabled" };
    renderSheet();

    expect(screen.getByRole("radio", { name: "IIWiki" })).toBeDisabled();
    expect(screen.getByText("IIWiki is switched off for now.")).toBeInTheDocument();
  });
});
