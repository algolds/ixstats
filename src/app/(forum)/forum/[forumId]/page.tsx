import { legacyRefFor } from "~/lib/thinkpages-forum/legacy-forum";
import { followLegacyRedirect } from "../legacy-gate";

export default async function ForumThreadListPage({
  params,
}: {
  params: Promise<{ forumId: string }>;
}) {
  const { forumId } = await params;
  return followLegacyRedirect(legacyRefFor("forum", forumId));
}
