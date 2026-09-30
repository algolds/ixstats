// src/components/wiki-os/reader/author-info.ts
// The reader's flat authorship shape, from the canonical one `wikios.getArticleAuthors` returns.

import type { ArticleAuthorInfo as CanonicalAuthorInfo } from "~/lib/wiki-os/types/canonical";
import type { ArticleAuthorInfo } from "./ArticleHeader";

type Person = Exclude<CanonicalAuthorInfo["creator"], string | null | undefined>;

/** The person behind a canonical `creator` / `lastEditor`: an object, or null for a bare name or nothing. */
function personOf(value: CanonicalAuthorInfo["creator"]): Person | null {
  return typeof value === "object" && value !== null ? value : null;
}

/** The display name of a canonical `creator` / `lastEditor`: its username, or the bare name. */
function nameOf(value: CanonicalAuthorInfo["creator"]): string | null {
  return personOf(value)?.username ?? (typeof value === "string" ? value : null);
}

/** Canonical authorship as the article header, byline and companion read it; null when there is none. */
export function normalizeAuthorInfo(
  raw: CanonicalAuthorInfo | null | undefined
): ArticleAuthorInfo | null {
  if (!raw) return null;

  const creator = personOf(raw.creator);
  const lastEditor = personOf(raw.lastEditor);
  const contributors = raw.topContributors ?? raw.contributors ?? [];
  return {
    creator: nameOf(raw.creator) ?? raw.author ?? null,
    creatorAvatar: creator?.avatar ?? raw.creatorAvatar ?? null,
    createdAt: raw.createdAt ?? creator?.timestamp ?? raw.createdTimestamp ?? null,
    lastEditor: nameOf(raw.lastEditor),
    lastEditorAvatar: lastEditor?.avatar ?? raw.lastEditorAvatar ?? null,
    lastEditedAt: raw.lastEditedAt ?? lastEditor?.timestamp ?? raw.lastModifiedTimestamp ?? null,
    contributors,
    totalContributors: raw.totalContributors ?? contributors.length,
  };
}
