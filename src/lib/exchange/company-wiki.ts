/**
 * Exchange ↔ WikiOS company lore & infobox service.
 *
 * Previews and re-syncs structured company metadata from an IxWiki or sister-wiki article
 * (`{{Infobox company}}`, lead summary, history excerpt, logo resolution, and HQ nation matching).
 */

import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { mediaWikiOrigin, parseWikiSource, type WikiSource } from "~/lib/wiki-os/config";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { assertTitleVisible } from "~/lib/wiki-os/permissions";
import { resolveImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import { wikiSourceLabel } from "~/lib/wiki-os/wiki-source-availability";
import { companyView, type SectorKey } from "./companies";
import {
  cleanWikiTextValue,
  type CountryMatchCandidate,
  extractLogoFilename,
  matchHqCountry,
  matchSectorAndSubIndustry,
  parseCompanyWikiPage,
  type ParsedCompanyWikiArticle,
  toCompanyWikiSlug,
} from "./company-wiki-parser";
import { assertExchangeOpen, type Db } from "./guards";
import type { SubIndustryKey } from "./taxonomy";

export {
  cleanWikiTextValue,
  type CountryMatchCandidate,
  extractLogoFilename,
  matchHqCountry,
  matchSectorAndSubIndustry,
  parseCompanyWikiPage,
  type ParsedCompanyWikiArticle,
  toCompanyWikiSlug,
};

export interface CompanyWikiData {
  /** The wiki the page is on. Rows synced before sister wikis could be a source have none, and are IxWiki pages. */
  wikiSource: WikiSource;
  wikiSlug: string;
  pageTitle: string;
  logoUrl: string | null;
  motto: string | null;
  summary: string | null;
  historyExcerpt: string | null;
  foundedText: string | null;
  keyPeople: string | null;
  products: string | null;
  headquartersText: string | null;
  industryText: string | null;
  syncedAt: string;
}

/**
 * Resolve a raw wiki logo filename or URL to a usable image URL: an IxWiki file via `MediaAssetService`, a sister
 * wiki's file through the media proxy.
 */
export async function resolveWikiLogoUrl(
  logoRaw: string | null,
  wiki: WikiSource = "ixwiki"
): Promise<string | null> {
  const extracted = extractLogoFilename(logoRaw);
  if (!extracted) return null;
  if (wiki !== "ixwiki") return resolveImageUrl(extracted, wiki) ?? null;
  if (/^https?:\/\//i.test(extracted) || extracted.startsWith("/")) {
    return extracted;
  }
  const asset = await MediaAssetService.findAsset(extracted);
  if (asset?.url) return asset.url;
  const { fullPath, cleanName } = MediaAssetService.getMd5ShardPath(extracted);
  if (!cleanName) return null;
  const baseUrl = mediaWikiOrigin().replace(/\/+$/, "");
  return `${baseUrl}/images/${fullPath}`;
}

/** The wiki a company's stored page is on: `wikiData.wikiSource`, IxWiki when the row does not say. */
export function companyWikiSource(wikiData: unknown): WikiSource {
  const stored =
    wikiData && typeof wikiData === "object" && !Array.isArray(wikiData)
      ? (wikiData as { wikiSource?: unknown }).wikiSource
      : null;
  return parseWikiSource(typeof stored === "string" ? stored : null);
}

/**
 * What a company linked to a page that could not be read yet keeps: the page and its wiki, so a later sync reads
 * the right wiki. Null for an IxWiki page, where the slug alone says it all.
 */
export function unreadCompanyWikiData(wikiSlug: string, wiki: WikiSource): CompanyWikiData | null {
  if (wiki === "ixwiki") return null;
  return {
    wikiSource: wiki,
    wikiSlug,
    pageTitle: wikiSlug.replace(/_/g, " "),
    logoUrl: null,
    motto: null,
    summary: null,
    historyExcerpt: null,
    foundedText: null,
    keyPeople: null,
    products: null,
    headquartersText: null,
    industryText: null,
    syncedAt: "",
  };
}

/** The page's wikitext; a wiki that cannot answer is an Exchange error in the wiki's own words, never a 500. */
async function readCompanyPage(
  ctx: WikiAuthContext,
  wikiSlug: string,
  wiki: WikiSource
): Promise<string | null> {
  try {
    await assertTitleVisible(ctx, wikiSlug, wiki);
    return (await getArticleWikitextShadow(wikiSlug, wiki))?.wikitext ?? null;
  } catch (error) {
    if (error instanceof WikiUnavailableError) throw new ExchangeError("DISABLED", error.message);
    throw error;
  }
}

export interface WikiCompanyPreviewResult {
  wikiSource: WikiSource;
  wikiSlug: string;
  pageTitle: string;
  companyName: string;
  sectorKey: SectorKey;
  subIndustryKey: SubIndustryKey;
  taxonomyMatch: "matched" | "default";
  hqCountryId: string | null;
  hqCountryName: string | null;
  wikiData: CompanyWikiData;
}

/**
 * Load a wiki article (IxWiki by default, or a sister wiki's page), parse its `{{Infobox company}}` & prose
 * sections, resolve its logo, and match its industry + headquarters nation in `realmId`.
 */
export async function previewWikiCompany(
  ctx: WikiAuthContext & { db: Db },
  rawTitle: string,
  realmId: string = DEFAULT_REALM_ID,
  wiki: WikiSource = "ixwiki"
): Promise<WikiCompanyPreviewResult> {
  const wikiSlug = toCompanyWikiSlug(rawTitle);
  if (!wikiSlug) {
    throw new ExchangeError("INVALID_AMOUNT", "Enter a valid wiki article title");
  }
  const wikitext = await readCompanyPage(ctx, wikiSlug, wiki);
  if (!wikitext) {
    throw new ExchangeError(
      "NOT_FOUND",
      `No ${wikiSourceLabel(wiki)} article found for "${wikiSlug.replace(/_/g, " ")}"`
    );
  }
  const parsed = parseCompanyWikiPage(wikiSlug, wikitext);
  const [logoUrl, realmNations] = await Promise.all([
    resolveWikiLogoUrl(parsed.logoRaw, wiki),
    ctx.db.country.findMany({
      where: { realmId },
      select: { id: true, name: true, slug: true },
      take: 200,
    }),
  ]);
  const matchedCountry = matchHqCountry(parsed.headquartersText, realmNations);
  const wikiData: CompanyWikiData = {
    wikiSource: wiki,
    wikiSlug: parsed.wikiSlug,
    pageTitle: parsed.pageTitle,
    logoUrl,
    motto: parsed.motto,
    summary: parsed.summary,
    historyExcerpt: parsed.historyExcerpt,
    foundedText: parsed.foundedText,
    keyPeople: parsed.keyPeople,
    products: parsed.products,
    headquartersText: parsed.headquartersText,
    industryText: parsed.industryText,
    syncedAt: new Date().toISOString(),
  };

  return {
    wikiSource: wiki,
    wikiSlug: parsed.wikiSlug,
    pageTitle: parsed.pageTitle,
    companyName: parsed.companyName,
    sectorKey: parsed.sectorKey,
    subIndustryKey: parsed.subIndustryKey,
    taxonomyMatch: parsed.taxonomyMatch,
    hqCountryId: matchedCountry?.id ?? null,
    hqCountryName: matchedCountry?.name ?? null,
    wikiData,
  };
}

export interface SyncCompanyFromWikiInput {
  companyId: string;
  wikiTitle?: string | null;
  /** The wiki to read; defaults to the wiki the company's page is already on. */
  wiki?: WikiSource;
  applyTaxonomyAndHq?: boolean;
  userId: string;
  isAdmin?: boolean;
}

/**
 * Re-sync an existing Exchange company's lore and metadata from its linked (or newly specified)
 * WikiOS article. Callable by the company's founder or a site administrator.
 */
export async function syncCompanyFromWiki(
  ctx: WikiAuthContext & { db: Db },
  input: SyncCompanyFromWikiInput
) {
  await assertExchangeOpen(ctx.db);
  const company = await ctx.db.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new ExchangeError("NOT_FOUND", "Company not found");
  if (company.founderId !== input.userId && !input.isAdmin) {
    throw new ExchangeError("FORBIDDEN", "Only the company founder can sync its WikiOS page");
  }
  if (company.status !== "ACTIVE" && company.status !== "DISTRESSED") {
    throw new ExchangeError("CONFLICT", "This company is no longer active");
  }

  const targetTitle = input.wikiTitle?.trim() || company.wikiSlug || company.name;
  const preview = await previewWikiCompany(
    ctx,
    targetTitle,
    company.realmId,
    input.wiki ?? companyWikiSource(company.wikiData)
  );

  const updated = await ctx.db.company.update({
    where: { id: company.id },
    data: {
      wikiSlug: preview.wikiSlug,
      wikiData: { ...preview.wikiData },
      ...(input.applyTaxonomyAndHq
        ? {
            sectorKey: preview.sectorKey,
            subIndustryKey: preview.subIndustryKey,
            ...(preview.hqCountryId ? { hqCountryId: preview.hqCountryId } : {}),
          }
        : {}),
    },
  });

  return { company: companyView(updated), preview };
}
