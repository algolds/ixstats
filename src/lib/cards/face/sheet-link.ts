// src/lib/cards/face/sheet-link.ts
/** Where a sheet was opened from, when that place shows art the viewer does not own (spec §2.3 Discovery). */
export type SheetFrom =
  | { kind: "showcase"; id: string }
  | { kind: "offer"; id: string }
  | { kind: "holder"; handle: string };

type FromBuilder = (value: string) => SheetFrom;

/** Each `?from=` kind, building the place from its value: the only list of kinds (the pattern takes any word). */
const FROM_KINDS: ReadonlyMap<string, FromBuilder> = new Map<string, FromBuilder>([
  ["showcase", (id) => ({ kind: "showcase", id })],
  ["offer", (id) => ({ kind: "offer", id })],
  ["holder", (handle) => ({ kind: "holder", handle })],
]);

const FROM_PATTERN = /^([a-z]+)\.([A-Za-z0-9_-]{1,64})$/;

export function encodeSheetFrom(from: SheetFrom): string {
  return from.kind === "holder" ? `holder.${from.handle}` : `${from.kind}.${from.id}`;
}

/** The `?from=` value, or null when it is missing, malformed or of an unknown kind. */
export function parseSheetFrom(raw: string | null | undefined): SheetFrom | null {
  const match = FROM_PATTERN.exec(raw ?? "");
  return match ? (FROM_KINDS.get(match[1])?.(match[2]) ?? null) : null;
}

/** A path that opens `cardId`'s sheet (`?card=`), keeping where it was opened from. */
export function cardSheetHref(path: string, cardId: string, from?: SheetFrom | null): string {
  const params = new URLSearchParams({ card: cardId });
  if (from) params.set("from", encodeSheetFrom(from));
  return `${path}?${params.toString()}`;
}
