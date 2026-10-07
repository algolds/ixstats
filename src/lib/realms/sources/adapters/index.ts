/**
 * The source adapters a realm's sync can use, by id (RealmSourceSync.format). Add a layout by writing an adapter
 * (./types.ts) and listing it here.
 */
import { jsNationTableAdapter } from "./js-nation-table";
import type { CommonSourceSettings, SourceAdapter } from "./types";

export const SOURCE_ADAPTERS: readonly SourceAdapter<any>[] = [jsNationTableAdapter];

export function sourceAdapter(format: string): SourceAdapter<CommonSourceSettings> | null {
  return SOURCE_ADAPTERS.find((adapter) => adapter.id === format) ?? null;
}

export const SOURCE_FORMATS = SOURCE_ADAPTERS.map((adapter) => ({
  id: adapter.id,
  label: adapter.label,
}));

export type { SourceAdapter, SourceFeature, SourceNation, SourceOrganization, SourceSnapshot } from "./types";
