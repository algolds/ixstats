import { redirect } from "next/navigation";
import { sessionUserId } from "~/app/thinkpages/_lib/session-user-id";
import { FORUM_HOME, hubHref } from "~/lib/thinkpages-forum/links";
import { myRealmSlugFor } from "~/server/api/routers/thinkpagesForum/mine";
import { db } from "~/server/db";

/**
 * "Your realm" in the sidebar: the Hub of the realm of the viewer's primary nation, or the forum home for a viewer
 * without a realm (and for visitors). Temporary (307): the answer depends on who asks. A server redirect, so the
 * route has no loading.tsx.
 */
export default async function MyRealmPage() {
  const slug = await myRealmSlugFor(db, await sessionUserId());
  redirect(slug ? hubHref(slug) : FORUM_HOME);
}
