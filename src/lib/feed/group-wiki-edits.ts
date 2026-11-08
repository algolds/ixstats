/** The fields wiki grouping reads; feed items carry many more. */
type WikiEditLike = {
  source?: string;
  user?: { name?: string } | null;
  content?: { title?: string; metadata?: { pageTitle?: string } | null } | null;
};

const wikiPageKey = (a: WikiEditLike) =>
  (a.source === "wiki" && a.content?.metadata?.pageTitle) || null;

/**
 * Every wiki edit to one page in the window becomes one entry, at the newest edit's place, so a page
 * edited between other pages' edits is not listed twice. The feed is newest first.
 */
export function groupWikiEdits<T extends WikiEditLike>(activities: T[]): T[] {
  const byPage = new Map<string, T[]>();
  for (const item of activities) {
    const key = wikiPageKey(item);
    if (key) byPage.set(key, [...(byPage.get(key) ?? []), item]);
  }
  return activities.flatMap((item, i) => {
    const key = wikiPageKey(item);
    const group = key ? byPage.get(key) : undefined;
    if (!key || !group) return [item];
    if (group[0] !== item) return [];
    if (group.length === 1) return [item];
    const editors = new Set(group.map((g) => g.user?.name).filter(Boolean));
    const isNew = group.some((g) => g.content?.title?.startsWith("New wiki page"));
    return [
      {
        ...item,
        id: `wiki-grouped-${key}-${i}`,
        content: { ...item.content, title: isNew ? `New wiki page: ${key}` : key },
        _grouped: true,
        _editCount: group.length,
        _editors: Array.from(editors),
        _subEdits: group,
        _isNew: isNew,
      },
    ];
  });
}
