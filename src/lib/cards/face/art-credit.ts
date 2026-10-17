// src/lib/cards/face/art-credit.ts
/** The `CardArtLicence` fields the back and the sheet show (Phase 2: one row per card, `Card.artLicence`). */
export interface ArtLicenceFacts {
  fileTitle: string | null;
  licence: string | null;
  artist: string | null;
  attribution: string | null;
  descriptionUrl: string | null;
}

/** The art credit the back and the sheet's About show (spec §2.4 Licensing). */
export interface ArtCredit {
  line: string;
  licence: string | null;
  sourceUrl: string | null;
}

const WEB_URL = /^https?:\/\//;

/** The recorded licence when the importer captured one, else the card's stored credit line. */
export function artCreditOf(card: {
  artworkCredit: string | null;
  artLicence: ArtLicenceFacts | null;
}): ArtCredit | null {
  const recorded = card.artLicence;
  if (recorded) {
    const name = recorded.fileTitle?.replace(/^File:/, "") ?? null;
    const who =
      name && recorded.artist ? `${name} by ${recorded.artist}` : (name ?? recorded.artist);
    const line = recorded.attribution?.trim() || [who, recorded.licence].filter(Boolean).join(", ");
    const url = recorded.descriptionUrl;
    const sourceUrl = url && WEB_URL.test(url) ? url : null;
    if (line) return { line, licence: recorded.licence, sourceUrl };
  }
  const legacy = card.artworkCredit?.trim();
  return legacy ? { line: legacy, licence: null, sourceUrl: null } : null;
}
