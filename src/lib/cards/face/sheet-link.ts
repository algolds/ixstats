// src/lib/cards/face/sheet-link.ts
/** Where a sheet was opened from, when that place shows art the viewer does not own (spec §2.3 Discovery). */
export type SheetFrom =
  | { kind: "showcase"; id: string }
  | { kind: "offer"; id: string }
  | { kind: "holder"; handle: string };

const FROM_PATTERN = /^(showcase|offer|holder)\.([A-Za-z0-9_-]{1,64})$/;

export function encodeSheetFrom(from: SheetFrom): string {
  return from.kind === "holder" ? `holder.${from.handle}` : `${from.kind}.${from.id}`;
}

/** The `?from=` value, or null when it is missing or malformed. */
export function parseSheetFrom(raw: string | null | undefined): SheetFrom | null {
  const match = FROM_PATTERN.exec(raw ?? "");
  if (!match) return null;
  const [, kind, value] = match;
  if (kind === "holder") return { kind, handle: value };
  return kind === "showcase" || kind === "offer" ? { kind, id: value } : null;
}

/** A path that opens `cardId`'s sheet (`?card=`), keeping where it was opened from. */
export function cardSheetHref(path: string, cardId: string, from?: SheetFrom | null): string {
  const params = new URLSearchParams({ card: cardId });
  if (from) params.set("from", encodeSheetFrom(from));
  return `${path}?${params.toString()}`;
}
