/** @jest-environment node */
/**
 * Exchange companies from a sister wiki's page: the picked wiki reaches the page read, the preview and the stored
 * `wikiData` say which wiki the page is on, a page that could not be read keeps its wiki for a later sync, and a wiki
 * that cannot answer (the IIWiki switch) is an Exchange error in its own words, never a crash.
 */
const mockWikitext = jest.fn();
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: (...args: unknown[]) => mockWikitext(...args),
}));
const mockAssertVisible = jest.fn();
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  assertTitleVisible: (...args: unknown[]) => mockAssertVisible(...args),
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { findAsset: jest.fn(async () => null), getMd5ShardPath: jest.fn() },
}));

import {
  companyWikiSource,
  previewWikiCompany,
  unreadCompanyWikiData,
} from "~/lib/exchange/company-wiki";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";

const WIKITEXT = `{{Infobox company
| name = Vanguard Aerospace
| industry = Aerospace
| headquarters = [[Caphiria]]
}}
'''Vanguard Aerospace''' builds aircraft.`;

const ctx = {
  db: {
    country: { findMany: jest.fn(async () => [{ id: "c1", name: "Caphiria", slug: "caphiria" }]) },
  },
} as never;

beforeEach(() => {
  mockWikitext.mockReset();
  mockAssertVisible.mockReset();
});

describe("previewWikiCompany on a sister wiki", () => {
  it("reads the page on the picked wiki and says which wiki it is on", async () => {
    mockWikitext.mockResolvedValue({ wikitext: WIKITEXT });

    const preview = await previewWikiCompany(ctx, "Vanguard Aerospace", "ixnay", "iiwiki");

    expect(mockAssertVisible).toHaveBeenCalledWith(ctx, "Vanguard_Aerospace", "iiwiki");
    expect(mockWikitext).toHaveBeenCalledWith("Vanguard_Aerospace", "iiwiki");
    expect(preview.wikiSource).toBe("iiwiki");
    expect(preview.wikiData.wikiSource).toBe("iiwiki");
    expect(preview.companyName).toBe("Vanguard Aerospace");
    expect(preview.hqCountryId).toBe("c1");
  });

  it("reads Wiki when no wiki is named", async () => {
    mockWikitext.mockResolvedValue({ wikitext: WIKITEXT });

    const preview = await previewWikiCompany(ctx, "Vanguard Aerospace");

    expect(mockWikitext).toHaveBeenCalledWith("Vanguard_Aerospace", "ixwiki");
    expect(preview.wikiData.wikiSource).toBe("ixwiki");
  });

  it("names the wiki that has no such page", async () => {
    mockWikitext.mockResolvedValue(null);

    await expect(previewWikiCompany(ctx, "Nowhere", "ixnay", "iiwiki")).rejects.toThrow(
      'No IIWiki article found for "Nowhere"'
    );
  });

  it("turns a switched-off IIWiki into an Exchange error in its own words", async () => {
    mockWikitext.mockRejectedValue(new WikiUnavailableError("IIWiki", "disabled"));

    const failure = previewWikiCompany(ctx, "Vanguard Aerospace", "ixnay", "iiwiki");

    await expect(failure).rejects.toBeInstanceOf(ExchangeError);
    await expect(failure).rejects.toMatchObject({
      code: "DISABLED",
      message: "IIWiki is switched off for now.",
    });
  });
});

describe("the stored page's wiki", () => {
  it("keeps a sister wiki's unread page and its wiki, and nothing for a Wiki page", () => {
    expect(unreadCompanyWikiData("Vanguard_Aerospace", "iiwiki")).toMatchObject({
      wikiSource: "iiwiki",
      wikiSlug: "Vanguard_Aerospace",
      pageTitle: "Vanguard Aerospace",
    });
    expect(unreadCompanyWikiData("Vanguard_Aerospace", "ixwiki")).toBeNull();
  });

  it("reads the wiki from wikiData, Wiki for rows that do not say", () => {
    expect(companyWikiSource({ wikiSource: "althistory" })).toBe("althistory");
    expect(companyWikiSource({ wikiSlug: "Old_Row" })).toBe("ixwiki");
    expect(companyWikiSource({ wikiSource: "elsewhere" })).toBe("ixwiki");
    expect(companyWikiSource(null)).toBe("ixwiki");
  });
});
