/**
 * "Discussed in N posts": how a tally of linking posts reads at a given place. Pure; the tally comes from
 * `actionLinks.discussionCounts` (`postIds` holds the newest one or two visible posts).
 */

export interface DiscussionTally {
  count: number;
  postIds: readonly string[];
}

/**
 * The tally without the post that is showing the card. A saved post's tokens are always linked, so when more posts exist than
 * are listed the current one is assumed to be among them; when every post is listed and it is not, it is not linked and
 * nothing is removed. The caller leaves the post out (no `currentPostId`) when the server never counts it, as for a
 * persona's post.
 */
export function othersOf(tally: DiscussionTally, currentPostId?: string): DiscussionTally {
  if (!currentPostId) return tally;
  if (tally.postIds.includes(currentPostId)) {
    return {
      count: tally.count - 1,
      postIds: tally.postIds.filter((id) => id !== currentPostId),
    };
  }
  if (tally.count > tally.postIds.length) return { count: tally.count - 1, postIds: tally.postIds };
  return tally;
}

export function discussedLabel(count: number, others: boolean): string {
  if (others) return `Also discussed in ${count === 1 ? "1 other post" : `${count} other posts`}`;
  return `Discussed in ${count === 1 ? "1 post" : `${count} posts`}`;
}

/** One line under a discussion's title: who wrote it and where. */
export function placeLine(item: {
  kind: "thread" | "board";
  author: { name: string };
  categoryName: string | null;
  realmName: string | null;
}): string {
  const where =
    item.kind === "board"
      ? item.realmName
        ? `on the ${item.realmName} board`
        : "on the board"
      : [item.categoryName, item.realmName].filter(Boolean).join(", ");
  if (!where) return item.author.name;
  return item.kind === "board" ? `${item.author.name} ${where}` : `${item.author.name} in ${where}`;
}

/**
 * The post id an action card inside a post leaves out of its tally. A persona's post is never counted (the server
 * leaves it out of every list so a nation's player cannot be read from the country side), so there is nothing to leave out.
 */
export function countedPostId(post: { id: string; persona: boolean }): string | undefined {
  return post.persona ? undefined : post.id;
}
