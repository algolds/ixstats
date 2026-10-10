/** The `/thinkpages/post/<id>` permalink's lookup in a thread (ruling P5). A board message has no thread page. */
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { canSeeThread, type ForumViewer } from "./access";
import { canModerateCategory } from "./mod-scope";
import { hiddenFilter, visibleRealmOf, type ReadsDb } from "./reads";

/** Where a post sits for the `/thinkpages/post/<id>` permalink (ruling P5); null when the viewer cannot see it. */
export async function resolvePostLocation(
  db: Pick<ReadsDb, "forumPost" | "realm">,
  viewer: ForumViewer,
  postId: string
): Promise<{ threadId: string; page: number } | null> {
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      threadId: true,
      createdAt: true,
      hidden: true,
      thread: {
        select: {
          authorUserId: true,
          hidden: true,
          category: {
            select: {
              id: true,
              key: true,
              style: true,
              visibility: true,
              scope: true,
              realmId: true,
            },
          },
        },
      },
    },
  });
  if (!post) return null;
  const { category } = post.thread;
  // A board message has no thread page: its permalink resolves through `boardPostRealm`.
  if (isBoardCategory(category) || !canSeeThread(viewer, post.thread, category)) return null;
  if (post.hidden && !canModerateCategory(viewer, category)) return null;
  if ((await visibleRealmOf(db, viewer, category)) === undefined) return null;
  const before = await db.forumPost.count({
    where: {
      threadId: post.threadId,
      ...hiddenFilter(viewer, category),
      OR: [
        { createdAt: { lt: post.createdAt } },
        { createdAt: post.createdAt, id: { lt: post.id } },
      ],
    },
  });
  return { threadId: post.threadId, page: Math.floor(before / POSTS_PER_PAGE) + 1 };
}
