import { legacyRefFor } from "~/lib/thinkpages-forum/legacy-forum";
import { followLegacyRedirect } from "../legacy-gate";
import ForumThreadListClient from "./ForumThreadListClient";

export default async function ForumThreadListPage({
  params,
}: {
  params: Promise<{ forumId: string }>;
}) {
  const { forumId } = await params;
  await followLegacyRedirect(legacyRefFor("forum", forumId));
  return <ForumThreadListClient />;
}
