/** A query string as a Next page receives it. */
export type PageQuery = Readonly<Record<string, string | string[] | undefined>>;

/** `path` with the query a request came with, re-encoded so a value cannot add a parameter or a fragment. */
export function withQuery(path: string, query: PageQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of [value ?? []].flat()) params.append(key, item);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
