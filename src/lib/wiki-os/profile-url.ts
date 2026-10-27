/**
 * Wiki user profiles live on the IxnayID passport (Work tab). The passport resolves a handle
 * against linked and external wiki usernames, so a raw MediaWiki name works here.
 * Returns an app-relative path; callers apply base-path handling as they already do.
 */
export function getWikiProfilePath(wikiUsername: string): string {
  const name = wikiUsername.trim().replace(/^@/, "");
  return `/@${encodeURIComponent(name)}?tab=work`;
}
