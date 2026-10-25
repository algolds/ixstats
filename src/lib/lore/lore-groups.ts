/**
 * The Lore tab's chapter groups (docs/superpowers/specs/2026-10-24-native-lore-design.md, "Lore tab"): a country's
 * pieces by type, People, Places, Events, Organisations, then Other, with each piece's chapter anchor. Pure.
 */
import { LORE_TYPES, type LoreType } from "./lore-types";

export const LORE_GROUP_LABEL: Readonly<Record<LoreType, string>> = {
  person: "People",
  place: "Places",
  event: "Events",
  organisation: "Organisations",
  other: "Other",
};

export interface LoreListedPiece {
  title: string;
  type: LoreType;
  pinned: boolean;
}

export interface LoreGroup<P> {
  type: LoreType;
  label: string;
  pieces: P[];
}

/** The pieces by type in the groups' order, each group in the list's own order; a group with no piece is left out. */
export function groupLorePieces<P extends { type: LoreType }>(
  pieces: readonly P[]
): LoreGroup<P>[] {
  return LORE_TYPES.map((type) => ({
    type,
    label: LORE_GROUP_LABEL[type],
    pieces: pieces.filter((piece) => piece.type === type),
  })).filter((group) => group.pieces.length > 0);
}

/** A piece's chapter id on the Lore tab; the prefix keeps it apart from the article's own heading ids. */
export function loreChapterId(title: string): string {
  return `lore-piece-${title.replace(/\s+/g, "_")}`;
}
