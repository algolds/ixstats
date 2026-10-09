// XenForo post permalinks (`/posts/<id>/`, sent here by nginx): the native post while the legacy switch is on. The
// bridge has no post page, so with the switch off they open the bridge's forum home.
import { redirect } from "next/navigation";
import { legacyRefFor } from "~/lib/thinkpages-forum/legacy-forum";
import { followLegacyRedirect } from "../../legacy-gate";

export default async function LegacyPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  await followLegacyRedirect(legacyRefFor("post", postId));
  redirect("/forum");
}
