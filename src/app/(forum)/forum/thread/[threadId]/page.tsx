import { legacyRefFor } from "~/lib/thinkpages-forum/legacy-forum";
import { followLegacyRedirect } from "../../legacy-gate";
import ThreadPageClient from "./ThreadPageClient";

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  await followLegacyRedirect(legacyRefFor("thread", threadId));
  return <ThreadPageClient />;
}
