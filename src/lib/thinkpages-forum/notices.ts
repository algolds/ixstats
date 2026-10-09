/**
 * The posting notice for a signed-in viewer who holds no nation in a realm. Shared by the server, which sends it,
 * and the realm section, which pairs exactly this notice with a "Claim a nation" link.
 */
export function noNationNotice(realmName: string): string {
  return `Only owners of a nation in ${realmName} can post here.`;
}
