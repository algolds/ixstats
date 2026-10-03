import type { ArticleAuthorInfo as CanonicalAuthorInfo } from "~/lib/wiki-os/types/canonical";
import type { ArticleAuthorInfo } from "./ArticleHeader";

/** Flatten the canonical authorship (people may be names or objects) into the reader's string form. */
export function toReaderAuthorInfo(info: CanonicalAuthorInfo): ArticleAuthorInfo {
  const creator = typeof info.creator === "object" ? info.creator : null;
  const lastEditor = typeof info.lastEditor === "object" ? info.lastEditor : null;
  return {
    creator:
      typeof info.creator === "object"
        ? (creator?.username ?? null)
        : (info.creator ?? info.author ?? null),
    creatorAvatar: creator?.avatar ?? info.creatorAvatar ?? null,
    createdAt: info.createdAt ?? creator?.timestamp ?? info.createdTimestamp ?? null,
    lastEditor:
      typeof info.lastEditor === "object"
        ? (lastEditor?.username ?? null)
        : (info.lastEditor ?? null),
    lastEditorAvatar: lastEditor?.avatar ?? info.lastEditorAvatar ?? null,
    lastEditedAt: info.lastEditedAt ?? lastEditor?.timestamp ?? info.lastModifiedTimestamp ?? null,
    contributors: info.topContributors ?? info.contributors ?? [],
    totalContributors: info.totalContributors ?? info.topContributors?.length ?? 0,
  };
}
