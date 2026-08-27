export function buildAuthoredArticles(rawAuthored: any[], mwCreatedPages: any[]) {
  const authoredArticles: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const seenTitles = new Set<string>();

  for (const a of rawAuthored) {
    if (!a?.title) continue;
    const key = a.title.toLowerCase();
    if (!seenTitles.has(key)) {
      authoredArticles.push({
        id: a.id,
        slug: a.slug || a.title.toLowerCase().replace(/ /g, "_"),
        title: a.title,
        summary: a.summary || "WikiOS Canonical Article",
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
      });
      seenTitles.add(key);
    }
  }

  for (const page of mwCreatedPages) {
    if (!(page as any)?.title) continue;
    const key = (page as any).title.toLowerCase();
    if (!seenTitles.has(key)) {
      authoredArticles.push({
        id: `mw-page-${key.replace(/[^a-z0-9]/g, "-")}`,
        slug: (page as any).title.toLowerCase().replace(/ /g, "_"),
        title: (page as any).title,
        summary: `Authored Wiki Article (${((page as any).byteSize || 0).toLocaleString()} B)`,
        createdAt: new Date((page as any).createdAt),
        updatedAt: new Date((page as any).createdAt),
      });
      seenTitles.add(key);
    }
  }

  authoredArticles.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return authoredArticles;
}

export function buildWikiActivityFeed(
  nativeRevisions: any[],
  wikiContribs: any[],
  wikiComments: any[],
  loreAwards: any[],
  resolvedWikiName: string | null
) {
  const wikiActivityFeed: Array<{
    id: string;
    type: "publish" | "revision" | "minor_edit" | "discussion" | "laurel";
    title: string;
    articleSlug: string;
    summary: string | null;
    byteDiff: number | null;
    timestamp: string;
    url: string;
  }> = [];

  for (const rev of nativeRevisions) {
    const articleTitle = rev.article?.title || "Wiki Article";
    const articleSlug = rev.article?.slug || rev.article?.title || "";
    wikiActivityFeed.push({
      id: `rev-${rev.id}`,
      type: rev.minor ? "minor_edit" : "revision",
      title: articleTitle,
      articleSlug,
      summary:
        rev.summary || (rev.minor ? "Minor formatting & copyedit" : "Revised article content"),
      byteDiff: null,
      timestamp: new Date(rev.createdAt).toISOString(),
      url: `/wiki/${encodeURIComponent(articleSlug || articleTitle)}`,
    });
  }

  for (const [idx, c] of wikiContribs.entries()) {
    const cTitle: string =
      (c as any).title ?? (c as any).page_title ?? (c as any).pageTitle ?? "Untitled";
    const cRevid = (c as any).revid ?? (c as any).rev_id ?? (c as any).revId ?? 0;
    const cTimestamp: string =
      (c as any).timestamp ??
      (c as any).rev_timestamp ??
      (c as any).revTimestamp ??
      new Date().toISOString();
    const cSize = (c as any).size ?? (c as any).rev_len ?? (c as any).revLen ?? null;
    const cComment: string | null = (c as any).comment ?? (c as any).rev_comment ?? null;
    const cIsNew: boolean = Boolean((c as any).isNew ?? (c as any).is_new);
    const cIsMinor: boolean = Boolean((c as any).minor ?? (c as any).rev_minor_edit);
    if (!cTitle || cTitle === "Untitled") {
      continue;
    }
    const ts = new Date(cTimestamp).getTime() || idx;
    const safeSlug = cTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24);
    wikiActivityFeed.push({
      id: `mw-${cRevid || 0}-${safeSlug}-${ts}-${idx}`,
      type: cIsNew ? "publish" : cIsMinor ? "minor_edit" : "revision",
      title: cTitle,
      articleSlug: cTitle.toLowerCase().replace(/ /g, "_"),
      summary: cComment || (cIsNew ? "Created new article" : "MediaWiki article revision"),
      byteDiff: cSize,
      timestamp: new Date(cTimestamp).toISOString(),
      url: `/wiki/${encodeURIComponent(cTitle)}`,
    });
  }

  for (const comment of wikiComments) {
    const threadTitle = comment.thread?.title || "Margin Discussion";
    const articleTitle = comment.thread?.articleTitle || "";
    wikiActivityFeed.push({
      id: `comment-${comment.id}`,
      type: "discussion",
      title: threadTitle,
      articleSlug: articleTitle,
      summary:
        comment.content.length > 120 ? `${comment.content.slice(0, 117)}...` : comment.content,
      byteDiff: null,
      timestamp: new Date(comment.createdAt).toISOString(),
      url: articleTitle ? `/wiki/${encodeURIComponent(articleTitle)}` : `/wiki`,
    });
  }

  for (const award of loreAwards) {
    const isWinner =
      resolvedWikiName && award.winnerUser?.toLowerCase() === resolvedWikiName.toLowerCase();
    const articleName =
      (isWinner ? award.winnerPage : award.runnerUpPage) || award.winnerPage || "Wiki Lore";
    const score = isWinner ? award.winnerScore : award.runnerUpScore;
    const distinction =
      award.type === "daily"
        ? "Lore of the Day"
        : award.type === "weekly"
          ? "Lore of the Week"
          : "Monthly Laureate";

    wikiActivityFeed.push({
      id: `laurel-${award.id}`,
      type: "laurel",
      title: articleName,
      articleSlug: articleName.toLowerCase().replace(/ /g, "_"),
      summary: `${distinction} (${isWinner ? "Winner" : "Runner-Up"}${score ? ` · +${score} pts` : ""})`,
      byteDiff: null,
      timestamp: new Date(award.date).toISOString(),
      url: `/wiki/${encodeURIComponent(articleName)}`,
    });
  }

  wikiActivityFeed.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return wikiActivityFeed;
}
