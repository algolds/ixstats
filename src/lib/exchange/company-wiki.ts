/**
 * Exchange ↔ WikiOS company lore & infobox parser.
 *
 * Extracts structured company metadata from a WikiOS article (`{{Infobox company}}`,
 * `{{Infobox enterprise}}`, `{{Infobox corporation}}`, `{{Infobox central bank}}`, etc.,
 * plus the lead summary and history excerpt), maps `|industry=` / `|sector=` to the
 * canonical Exchange sector + sub-industry taxonomy, and matches `|headquarters=` /
 * `|country=` against the realm's sovereign nations.
 */

import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { getArticleWikitextShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { assertTitleVisible } from "~/lib/wiki-os/permissions";
import type { SectorKey } from "./companies";
import { assertExchangeOpen, type Db } from "./guards";
import { SUB_INDUSTRIES, type SubIndustryKey } from "./taxonomy";

export interface CompanyWikiData {
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

export interface ParsedCompanyWikiArticle {
  wikiSlug: string;
  pageTitle: string;
  companyName: string;
  logoRaw: string | null;
  motto: string | null;
  summary: string | null;
  historyExcerpt: string | null;
  foundedText: string | null;
  keyPeople: string | null;
  products: string | null;
  headquartersText: string | null;
  industryText: string | null;
  sectorKey: SectorKey;
  subIndustryKey: SubIndustryKey;
  taxonomyMatch: "matched" | "default";
}

export interface CountryMatchCandidate {
  id: string;
  name: string;
  slug?: string | null;
}

const MAX_WIKITEXT_LENGTH = 200_000;
const MAX_SUMMARY_LENGTH = 600;
const MAX_FIELD_LENGTH = 240;

const SUB_INDUSTRY_KEYWORDS: Record<SubIndustryKey, readonly string[]> = {
  agribusiness: ["agriculture", "agribusiness", "crop", "farming", "grain", "livestock", "plantation"],
  forestry_fisheries: ["forestry", "timber", "lumber", "fishery", "fisheries", "fishing", "seafood", "aquaculture"],
  biotech_food: ["food", "beverage", "brewery", "winery", "distillery", "retail", "supermarket", "restaurant", "consumer", "agri-biotech"],
  energy_mining: ["oil", "petroleum", "gas", "mining", "mineral", "ore", "coal", "lithium", "gold", "copper", "extraction", "refinery", "energy", "hydrocarbon"],
  heavy_manufacturing: ["manufacturing", "steel", "metallurgy", "machinery", "automotive", "automobile", "shipbuilding", "shipyard", "heavy industry", "construction", "industrial", "engineering", "locomotive"],
  chemicals: ["chemical", "chemicals", "petrochemical", "polymer", "plastics", "fertilizer", "materials", "synthetics"],
  finance_insurance: ["bank", "banking", "central bank", "credit", "lending", "insurance", "reinsurance", "investment", "asset management", "venture capital", "private equity", "financial", "finance", "holding company", "conglomerate", "holdings"],
  logistics: ["logistics", "shipping", "maritime", "port", "freight", "rail", "railway", "airline", "aviation", "airways", "transport", "transportation", "cargo", "supply chain", "courier"],
  software_media: ["software", "technology", "cloud", "cybersecurity", "internet", "media", "broadcasting", "publishing", "telecom", "telecommunications", "semiconductor", "electronics", "computing", "artificial intelligence", "gaming", "entertainment"],
  civic_utilities: ["utility", "utilities", "power grid", "electricity", "water", "nuclear", "solar", "wind", "hydro", "renewable", "public works", "municipal", "transit"],
  defense_aerospace: ["defense", "defence", "aerospace", "weapons", "armaments", "arms", "military", "munitions", "ordnance", "naval systems", "space", "aviation systems"],
  pharma_biotech: ["pharmaceutical", "pharma", "healthcare", "hospital", "medical", "medicine", "biotech", "biotechnology", "clinical", "life sciences", "genomics"],
};

/** Normalize a user-supplied wiki title or URL fragment into a canonical WikiOS slug (`Foo_Bar`). */
export function toCompanyWikiSlug(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  const wikiPathIdx = cleaned.indexOf("/wiki/");
  if (wikiPathIdx !== -1) {
    cleaned = cleaned.slice(wikiPathIdx + 6);
  }
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // keep raw if malformed percent-encoding
  }
  const slug = cleaned
    .replace(/^:?/, "")
    .replace(/#.*$/, "")
    .replace(/\?.*$/, "")
    .trim()
    .replace(/[\s_]+/g, "_");
  if (!slug || /^(?:file|image|media|category):/i.test(slug)) return null;
  return slug.slice(0, 200);
}

/** Strip HTML comments (`<!-- ... -->`) in linear time. */
function stripComments(text: string): string {
  const out: string[] = [];
  let pos = 0;
  for (;;) {
    const open = text.indexOf("<!--", pos);
    if (open === -1) {
      out.push(text.slice(pos));
      return out.join("");
    }
    out.push(text.slice(pos, open));
    const close = text.indexOf("-->", open + 4);
    if (close === -1) return out.join("");
    pos = close + 3;
  }
}

/** Strip `<ref>...</ref>` and `<ref .../>` tags in linear time. */
function stripRefs(text: string): string {
  const lower = text.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const out: string[] = [];
  let pos = 0;
  for (let open = lower.indexOf("<ref", pos); open !== -1; open = lower.indexOf("<ref", pos)) {
    const after = lower[open + 4];
    if (after !== undefined && after !== ">" && after !== "/" && after !== " " && after !== "\t" && after !== "\n") {
      out.push(text.slice(pos, open + 4));
      pos = open + 4;
      continue;
    }
    const tagEnd = lower.indexOf(">", open + 4);
    if (tagEnd === -1) break;
    out.push(text.slice(pos, open));
    if (lower[tagEnd - 1] === "/") {
      pos = tagEnd + 1;
      continue;
    }
    const close = lower.indexOf("</ref>", tagEnd + 1);
    if (close === -1) return out.join("");
    pos = close + 6;
  }
  out.push(text.slice(pos));
  return out.join("");
}

/** Clean inline wikitext markup into readable plain text. */
export function cleanWikiTextValue(raw: string, maxLen = MAX_FIELD_LENGTH): string {
  let text = stripRefs(stripComments(raw));
  // Replace <br>, <br/>, * bullets with comma separators
  text = text.replace(/<br\s*\/?>/gi, ", ");
  text = text.replace(/\n\s*\*+\s*/g, ", ");
  // Strip File/Image embeds [[File:...|...]]
  text = text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");
  // Unwrap [[Target|Label]] -> Label and [[Target]] -> Target
  text = text.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_m, target: string, label?: string) => {
    const chosen = label !== undefined && label.trim() ? label : target;
    return chosen.trim();
  });
  // Unwrap simple formatting templates like {{nowrap|...}} or {{ubl|a|b}}
  text = text.replace(/\{\{(?:nowrap|plainlist|flatlist|ubl|unbulleted list|hlist)\|([^{}]*)\}\}/gi, (_m, inner: string) =>
    inner.replace(/\|/g, ", ")
  );
  // Strip remaining templates {{...}} iteratively (bounded)
  for (let i = 0; i < 4 && text.includes("{{"); i++) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, "");
    if (next === text) break;
    text = next;
  }
  // Strip HTML tags
  text = text.replace(/<\/?[a-z][^>\n]*>/gi, "");
  // Strip bold/italic quotes
  text = text.replace(/''+/g, "");
  // Normalize whitespace and stray commas
  text = text
    .replace(/\s+/g, " ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/^,\s*|\s*,$/g, "")
    .trim();
  if (text.length > maxLen) {
    return `${text.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return text;
}

/** Extract the first balanced `{{Infobox ...}}` template block from wikitext, if any. */
function extractInfoboxBlock(wikitext: string): { block: string; endIndex: number } | null {
  const match = /\{\{\s*infobox\b/i.exec(wikitext);
  if (!match) return null;
  const start = match.index;
  let depth = 0;
  let i = start;
  while (i < wikitext.length - 1) {
    const two = wikitext.slice(i, i + 2);
    if (two === "{{") {
      depth++;
      i += 2;
      continue;
    }
    if (two === "}}") {
      depth--;
      i += 2;
      if (depth === 0) {
        return { block: wikitext.slice(start, i), endIndex: i };
      }
      continue;
    }
    i++;
  }
  return { block: wikitext.slice(start), endIndex: wikitext.length };
}

/** Parse top-level `| key = value` pairs inside a `{{Infobox ...}}` block. */
function parseInfoboxParams(block: string): Record<string, string> {
  const params: Record<string, string> = {};
  // Strip outer {{ and }}
  const inner = block.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts: string[] = [];
  let depthBrace = 0;
  let depthBracket = 0;
  let lastSplit = 0;

  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === "{{") {
      depthBrace++;
      i++;
      continue;
    }
    if (two === "}}") {
      depthBrace = Math.max(0, depthBrace - 1);
      i++;
      continue;
    }
    if (two === "[[") {
      depthBracket++;
      i++;
      continue;
    }
    if (two === "]]") {
      depthBracket = Math.max(0, depthBracket - 1);
      i++;
      continue;
    }
    if (inner[i] === "|" && depthBrace === 0 && depthBracket === 0) {
      parts.push(inner.slice(lastSplit, i));
      lastSplit = i + 1;
    }
  }
  parts.push(inner.slice(lastSplit));

  // Skip index 0 (template name)
  for (let idx = 1; idx < parts.length; idx++) {
    const part = parts[idx]!;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part
      .slice(0, eq)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const val = part.slice(eq + 1).trim();
    if (key && val && !params[key]) {
      params[key] = val;
    }
  }
  return params;
}

function firstParam(params: Record<string, string>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = params[k];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

/** Extract clean filename or URL from a `|logo=` or `|image=` parameter value. */
export function extractLogoFilename(rawLogo: string | null): string | null {
  if (!rawLogo) return null;
  const trimmed = stripComments(rawLogo).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed.split(/\s/)[0] ?? null;
  }
  // Match [[File:Example.svg|...]] or [[Image:Example.png|...]]
  const fileLink = /\[\[\s*(?:File|Image)\s*:([^\]|]+)/i.exec(trimmed);
  if (fileLink?.[1]) {
    return fileLink[1].trim();
  }
  // Bare File:Example.svg or Example.svg
  const bare = trimmed.replace(/^(?:File|Image)\s*:/i, "").split("|")[0]?.trim() ?? "";
  if (bare && /\.(?:svg|png|jpe?g|webp|gif|avif)$/i.test(bare)) {
    return bare;
  }
  return null;
}

/** Resolve a raw wiki logo filename or URL to a usable image URL via `MediaAssetService`. */
export async function resolveWikiLogoUrl(logoRaw: string | null): Promise<string | null> {
  const extracted = extractLogoFilename(logoRaw);
  if (!extracted) return null;
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

/** Strip leading templates at the top of the article body to find the lead prose paragraph. */
function stripLeadingTemplates(text: string): string {
  let pos = 0;
  while (pos < text.length) {
    while (pos < text.length && /\s/.test(text[pos]!)) pos++;
    if (text.slice(pos, pos + 2) === "{{") {
      let depth = 0;
      let i = pos;
      while (i < text.length - 1) {
        const two = text.slice(i, i + 2);
        if (two === "{{") {
          depth++;
          i += 2;
          continue;
        }
        if (two === "}}") {
          depth--;
          i += 2;
          if (depth === 0) break;
          continue;
        }
        i++;
      }
      pos = i;
      continue;
    }
    if (text.slice(pos, pos + 2).toLowerCase() === "[[") {
      const rest = text.slice(pos);
      if (/^\[\[(?:file|image|category):/i.test(rest)) {
        const endBracket = rest.indexOf("]]");
        if (endBracket !== -1) {
          pos += endBracket + 2;
          continue;
        }
      }
    }
    break;
  }
  return text.slice(pos);
}

/** Extract the lead summary paragraph and an optional History/Overview section excerpt. */
function extractLeadAndHistory(cleanedWikitext: string): {
  summary: string | null;
  historyExcerpt: string | null;
} {
  const firstHeadingMatch = /^==+[^=\n]+==+/m.exec(cleanedWikitext);
  const leadRaw =
    firstHeadingMatch !== null
      ? cleanedWikitext.slice(0, firstHeadingMatch.index)
      : cleanedWikitext;
  const leadBody = stripLeadingTemplates(leadRaw);
  const leadParagraphs = leadBody
    .split(/\n\s*\n/)
    .map((p) => cleanWikiTextValue(p, MAX_SUMMARY_LENGTH))
    .filter((p) => p.length >= 20 && !p.startsWith("__"));
  const summary = leadParagraphs[0] ?? null;

  let historyExcerpt: string | null = null;
  const historyMatch = /^==+\s*(?:history|overview|background|operations|corporate history)\s*==+/im.exec(
    cleanedWikitext
  );
  if (historyMatch) {
    const afterHeading = cleanedWikitext.slice(historyMatch.index + historyMatch[0].length);
    const nextHeading = /^==+[^=\n]+==+/m.exec(afterHeading);
    const sectionBody = nextHeading ? afterHeading.slice(0, nextHeading.index) : afterHeading;
    const paragraphs = stripLeadingTemplates(sectionBody)
      .split(/\n\s*\n/)
      .map((p) => cleanWikiTextValue(p, MAX_SUMMARY_LENGTH))
      .filter((p) => p.length >= 20);
    historyExcerpt = paragraphs[0] ?? null;
  }

  return { summary, historyExcerpt };
}

/** Map free-form industry/products/summary text to the closest Exchange Sector & Sub-Industry. */
export function matchSectorAndSubIndustry(
  industryText: string | null,
  productsText?: string | null,
  summaryText?: string | null
): { sectorKey: SectorKey; subIndustryKey: SubIndustryKey; taxonomyMatch: "matched" | "default" } {
  const primaryCorpus = (industryText ?? "").toLowerCase();
  const secondaryCorpus = `${productsText ?? ""} ${summaryText ?? ""}`.toLowerCase();

  let bestSub: SubIndustryKey = "software_media";
  let bestSector: SectorKey = "services";
  let bestScore = 0;

  for (const sub of SUB_INDUSTRIES) {
    const keywords = SUB_INDUSTRY_KEYWORDS[sub.key];
    let score = 0;
    for (const kw of keywords) {
      if (primaryCorpus.includes(kw)) {
        score += 4;
      } else if (secondaryCorpus.includes(kw)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSub = sub.key;
      bestSector = sub.sectorKey;
    }
  }

  return {
    sectorKey: bestSector,
    subIndustryKey: bestSub,
    taxonomyMatch: bestScore > 0 ? "matched" : "default",
  };
}

/** Match headquarters/country text against a list of realm countries. */
export function matchHqCountry(
  headquartersText: string | null,
  countries: readonly CountryMatchCandidate[]
): CountryMatchCandidate | null {
  if (!headquartersText || countries.length === 0) return null;
  const hay = headquartersText.toLowerCase();

  // Prefer exact match first, then longest country-name substring match
  const sorted = [...countries].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    const cName = c.name.trim().toLowerCase();
    if (!cName) continue;
    if (hay === cName || (c.slug && hay === c.slug.toLowerCase())) {
      return c;
    }
  }
  for (const c of sorted) {
    const cName = c.name.trim().toLowerCase();
    if (!cName) continue;
    if (hay.includes(cName)) {
      return c;
    }
  }
  return null;
}

/** Parse a WikiOS article's title and wikitext into structured Exchange company metadata. */
export function parseCompanyWikiPage(
  rawTitle: string,
  rawWikitext: string
): ParsedCompanyWikiArticle {
  const wikiSlug = toCompanyWikiSlug(rawTitle) ?? "Company";
  const pageTitle = wikiSlug.replace(/_/g, " ");
  const bounded = rawWikitext.slice(0, MAX_WIKITEXT_LENGTH);
  const cleanedWikitext = stripRefs(stripComments(bounded));

  const infobox = extractInfoboxBlock(cleanedWikitext);
  const params = infobox ? parseInfoboxParams(infobox.block) : {};

  const rawCompanyName = firstParam(params, ["name", "company_name", "title", "official_name"]);
  const companyName =
    (rawCompanyName ? cleanWikiTextValue(rawCompanyName, 80) : "") || pageTitle;

  const logoRaw = firstParam(params, ["logo", "company_logo", "image", "coat_of_arms", "emblem"]);
  const rawMotto = firstParam(params, ["motto", "slogan", "tagline", "caption"]);
  const rawIndustry = firstParam(params, ["industry", "sector", "type", "genre"]);
  const rawFounded = firstParam(params, ["founded", "foundation", "established", "formation"]);
  const rawHq = firstParam(params, [
    "headquarters",
    "hq_location",
    "hq_location_city",
    "hq_location_country",
    "location",
    "country",
    "domicile",
  ]);
  const rawKeyPeople = firstParam(params, [
    "key_people",
    "founder",
    "founders",
    "ceo",
    "chairman",
    "leader_name",
    "governor",
    "president",
  ]);
  const rawProducts = firstParam(params, [
    "products",
    "services",
    "brands",
    "divisions",
    "subsidiaries",
    "production",
  ]);

  const motto = rawMotto ? cleanWikiTextValue(rawMotto, 160) || null : null;
  const industryText = rawIndustry ? cleanWikiTextValue(rawIndustry, 160) || null : null;
  const foundedText = rawFounded ? cleanWikiTextValue(rawFounded, 120) || null : null;
  const headquartersText = rawHq ? cleanWikiTextValue(rawHq, 160) || null : null;
  const keyPeople = rawKeyPeople ? cleanWikiTextValue(rawKeyPeople, 200) || null : null;
  const products = rawProducts ? cleanWikiTextValue(rawProducts, 200) || null : null;

  const { summary, historyExcerpt } = extractLeadAndHistory(cleanedWikitext);
  const { sectorKey, subIndustryKey, taxonomyMatch } = matchSectorAndSubIndustry(
    industryText,
    products,
    summary
  );

  return {
    wikiSlug,
    pageTitle,
    companyName,
    logoRaw,
    motto,
    summary,
    historyExcerpt,
    foundedText,
    keyPeople,
    products,
    headquartersText,
    industryText,
    sectorKey,
    subIndustryKey,
    taxonomyMatch,
  };
}

export interface WikiCompanyPreviewResult {
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
 * Load a WikiOS article, parse its `{{Infobox company}}` & prose sections, resolve its logo
 * via `MediaAssetService`, and match its industry + headquarters nation in `realmId`.
 */
export async function previewWikiCompany(
  ctx: WikiAuthContext & { db: Db },
  rawTitle: string,
  realmId: string = DEFAULT_REALM_ID
): Promise<WikiCompanyPreviewResult> {
  const wikiSlug = toCompanyWikiSlug(rawTitle);
  if (!wikiSlug) {
    throw new ExchangeError("INVALID_AMOUNT", "Enter a valid WikiOS article title");
  }
  await assertTitleVisible(ctx, wikiSlug, "ixwiki");
  const page = await getArticleWikitextShadow(wikiSlug, "ixwiki");
  if (!page?.wikitext) {
    throw new ExchangeError(
      "NOT_FOUND",
      `No WikiOS article found for "${wikiSlug.replace(/_/g, " ")}"`
    );
  }
  const parsed = parseCompanyWikiPage(wikiSlug, page.wikitext);
  const [logoUrl, realmNations] = await Promise.all([
    resolveWikiLogoUrl(parsed.logoRaw),
    ctx.db.country.findMany({
      where: { realmId },
      select: { id: true, name: true, slug: true },
      take: 200,
    }),
  ]);
  const matchedCountry = matchHqCountry(parsed.headquartersText, realmNations);
  const wikiData: CompanyWikiData = {
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
  const preview = await previewWikiCompany(ctx, targetTitle, company.realmId);

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

  return { company: updated, preview };
}
