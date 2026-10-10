// XenForo post permalinks (`/posts/<id>/`, sent here by nginx): the imported native post, else the forum home.
import { legacyRefFor } from "~/lib/thinkpages-forum/legacy-forum";
import { followLegacyRedirect } from "../../legacy-gate";

export default async function LegacyPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return followLegacyRedirect(legacyRefFor("post", postId));
}
