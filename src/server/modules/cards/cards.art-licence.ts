/**
 * Capture a card art's provenance and licence at import (licensing drafts §2.5(b)): `imageinfo` extmetadata first,
 * then the File page's categories and licence templates, because IxWiki's and Fandom's local files name no licence
 * in extmetadata (.superpowers/sdd/435-cards-phase-2/spike-sources.md). Only a named licence (`LicenseShortName` or
 * `UsageTerms`) counts, never extmetadata merely having keys.
 */
import { z } from "zod";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { createDiscoveryClient } from "~/lib/realms/sources/wiki-discovery-client";
import {
  asFileTitle,
  attributionLine,
  fetchWikiFileInfo,
} from "~/lib/realms/sources/wiki-file-info";
import { classifyLicence, licenceTemplates, type LicenceStatus } from "~/lib/cards/art-licence";
import type { CardWikiSource } from "~/lib/cards/card-sources";

export interface CapturedLicence {
  fileTitle: string;
  fileUrl: string;
  descriptionUrl: string | null;
  licence: string | null;
  licenceUrl: string | null;
  artist: string | null;
  /** The credit line to show with the art. */
  attribution: string;
  status: LicenceStatus;
}

const FilePageSchema = z.object({
  query: z
    .object({
      pages: z.array(
        z.object({
          title: z.string(),
          categories: z.array(z.object({ title: z.string() })).optional(),
          revisions: z
            .array(
              z.object({ slots: z.object({ main: z.object({ content: z.string().optional() }) }) })
            )
            .optional(),
        })
      ),
    })
    .optional(),
});

/** The File page's category names and template names: the fallback when extmetadata names no licence. */
async function filePageLicenceHints(query: WikiQuery, fileTitle: string): Promise<string[]> {
  const data = await query(
    {
      titles: fileTitle,
      prop: "categories|revisions",
      rvprop: "content",
      rvslots: "main",
      cllimit: "50",
    },
    FilePageSchema
  );
  const page = data.query?.pages[0];
  if (!page) return [];
  const categories = (page.categories ?? []).map((category) =>
    category.title.replace(/^Category:/, "")
  );
  return [...categories, ...licenceTemplates(page.revisions?.[0]?.slots.main.content ?? "")];
}

/** The hint that decides: a restricted licence over an open one; null when no hint reads as a licence. */
function decidingHint(hints: string[]): string | null {
  const status = (hint: string) => classifyLicence([hint]);
  return (
    hints.find((hint) => status(hint) === "RESTRICTED") ??
    hints.find((hint) => status(hint) === "OPEN") ??
    null
  );
}

/** A throttled query for one-off captures; the import runner passes one client per run instead. */
export function wikiQueryFor(source: CardWikiSource, maxRequests = 20): WikiQuery {
  return createDiscoveryClient(source, { maxRequests }).query;
}

/** The file's provenance and licence, or null when the wiki has no such file. */
export async function captureArtLicence(
  query: WikiQuery,
  source: CardWikiSource,
  fileName: string
): Promise<CapturedLicence | null> {
  const fileTitle = asFileTitle(fileName);
  const info = (await fetchWikiFileInfo(source, query, [fileTitle])).get(fileTitle);
  if (!info) return null;

  const captured: CapturedLicence = {
    fileTitle,
    fileUrl: info.url,
    descriptionUrl: info.descriptionUrl,
    licence: info.licence,
    licenceUrl: info.licenceUrl,
    artist: info.artist,
    attribution: info.attribution,
    status: classifyLicence([info.licence]),
  };
  if (captured.status !== "UNKNOWN") return captured;

  const licence = decidingHint(await filePageLicenceHints(query, fileTitle));
  if (!licence) return captured;
  // The credit line names the licence the File page gave, unless the file states its own.
  const attribution = attributionLine(info.holder, fileTitle, {
    attribution: info.ownAttribution,
    artist: info.artist,
    licence,
  });
  return { ...captured, licence, attribution, status: classifyLicence([licence]) };
}
