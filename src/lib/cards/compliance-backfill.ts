/**
 * Bringing pre-Phase 2 cards into Compliance. An NS takedown marker (`metadata.nsTakedown`) becomes a HIDDEN
 * takedown that restore can bring back from the flag. An existing card's art gets a licence record, UNKNOWN until an
 * admin (or a `--fetch` run) checks it.
 */
import type { CardTakedownOrigin, Prisma } from "@prisma/client";
import { commonsFileName, fileNameFromArtworkUrl } from "~/lib/cards/art-licence";
import { parseCardWikiSource, type CardWikiSource } from "~/lib/cards/card-sources";
import { isJsonObject, nsFactsOf } from "~/lib/cards/ns-facts";
import { takedownDueAt } from "~/lib/cards/takedown-deadline";
import { asFileTitle } from "~/lib/realms/sources/wiki-file-info";

const text = (value: Prisma.JsonValue | undefined): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** The marker's date, or the retirement's when the marker has none it can read. */
function hiddenDate(marker: Prisma.JsonObject, retiredAt: Date | null): Date {
  const stamped = text(marker.hiddenAt);
  const date = stamped ? new Date(stamped) : null;
  return date && !Number.isNaN(date.getTime()) ? date : (retiredAt ?? new Date());
}

export function legacyTakedownRow(card: {
  id: string;
  retiredAt: Date | null;
  metadata: Prisma.JsonValue;
}): Prisma.CardTakedownCreateManyInput | null {
  const marker = isJsonObject(card.metadata) ? card.metadata.nsTakedown : undefined;
  if (!isJsonObject(marker)) return null;
  const hiddenAt = hiddenDate(marker, card.retiredAt);
  const selfService = marker.selfService === true;
  const origin: CardTakedownOrigin = selfService ? "NS_SELF_SERVICE" : "ADMIN";
  const nation = text(marker.verifiedNation);
  const hiddenBy = text(marker.hiddenBy);
  return {
    cardId: card.id,
    origin,
    status: "HIDDEN",
    reason: text(marker.reason) ?? (selfService ? "Flag owner takedown" : "Hidden by an admin"),
    contact: nation ? `NationStates: ${nation}` : null,
    requestedBy: hiddenBy,
    receivedAt: hiddenAt,
    dueAt: takedownDueAt(hiddenAt),
    savedArtwork: nsFactsOf(card.metadata).flag ?? null,
    // Every old takedown retired its card, and the old restore un-retired it.
    retiredByTakedown: true,
    resolvedAt: hiddenAt,
    resolvedBy: hiddenBy,
  };
}

/**
 * The wiki file an art URL names: the card's own wiki's, else a Commons file (a sister wiki's article can show Commons
 * art, which is credited on Commons), else none.
 */
function artFile(
  url: string,
  source: CardWikiSource
): { wiki: CardWikiSource; name: string } | null {
  const own = fileNameFromArtworkUrl(url, source);
  if (own) return { wiki: source, name: own };
  const commons = commonsFileName(url);
  return commons ? { wiki: "commons", name: commons } : null;
}

export function licenceBackfillRow(card: {
  id: string;
  wikiSource: string | null;
  artwork: string | null;
}): Prisma.CardArtLicenceCreateManyInput | null {
  // The site's own placeholder art needs no licence.
  if (!card.artwork || card.artwork.startsWith("/images/")) return null;
  const source = parseCardWikiSource(card.wikiSource) ?? "ixwiki";
  const file = artFile(card.artwork, source);
  return {
    cardId: card.id,
    wiki: file?.wiki ?? source,
    fileTitle: file ? asFileTitle(file.name) : null,
    fileUrl: card.artwork,
    status: "UNKNOWN",
    note: "Recorded when Compliance started; not yet checked",
  };
}
