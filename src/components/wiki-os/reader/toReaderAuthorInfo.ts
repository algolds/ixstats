import type { ArticleAuthorInfo as CanonicalAuthorInfo } from "~/lib/wiki-os/types/canonical";
import type { ArticleAuthorInfo } from "./ArticleHeader";

/** First value that is neither null nor undefined, else null. */
const firstSet = <T>(...values: Array<T | null | undefined>): T | null =>
  values.find((v): v is T => v != null) ?? null;

/** Flatten the canonical authorship (people may be names or objects) into the reader's string form. */
export function toReaderAuthorInfo(info: CanonicalAuthorInfo): ArticleAuthorInfo {
  // `typeof null` is "object": a null creator must still fall back to `author`.
  const creator = typeof info.creator === "object" ? info.creator : null;
  const lastEditor = typeof info.lastEditor === "object" ? info.lastEditor : null;
  return {
    creator: creator
      ? firstSet(creator.username)
      : firstSet(typeof info.creator === "string" ? info.creator : null, info.author),
    creatorAvatar: firstSet(creator?.avatar, info.creatorAvatar),
    createdAt: firstSet(info.createdAt, creator?.timestamp, info.createdTimestamp),
    lastEditor:
      typeof info.lastEditor === "object"
        ? firstSet(lastEditor?.username)
        : firstSet(info.lastEditor),
    lastEditorAvatar: firstSet(lastEditor?.avatar, info.lastEditorAvatar),
    lastEditedAt: firstSet(info.lastEditedAt, lastEditor?.timestamp, info.lastModifiedTimestamp),
    contributors: info.topContributors ?? info.contributors ?? [],
    totalContributors: firstSet(info.totalContributors, info.topContributors?.length) ?? 0,
  };
}
