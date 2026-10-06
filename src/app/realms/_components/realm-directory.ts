import type { RouterOutputs } from "~/trpc/react";

export type DirectoryRealm = RouterOutputs["realms"]["directory"][number];

/** The realm page, or one of its tabs (`"nations"`, `"board"`). */
export function realmHref(slug: string, tab?: string): string {
  const base = `/r/${encodeURIComponent(slug)}`;
  return tab ? `${base}/${tab}` : base;
}

/** Nations a newcomer can take in a realm: unclaimed countries plus nation pages no country has taken yet. */
export function openToJoinCount(realm: DirectoryRealm): number {
  return realm.openNationCount + realm.openNationPageCount;
}

/** "1 nation", "3 nations". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** Whether a realm matches a search on its name, description or tags (case-insensitive). */
export function realmMatches(realm: DirectoryRealm, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    realm.name.toLowerCase().includes(q) ||
    !!realm.description?.toLowerCase().includes(q) ||
    realm.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}
