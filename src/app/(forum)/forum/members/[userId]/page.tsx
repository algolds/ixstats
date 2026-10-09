import { legacyRefFor } from "~/lib/thinkpages-forum/legacy-forum";
import { followLegacyRedirect } from "../../legacy-gate";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return followLegacyRedirect(legacyRefFor("member", userId));
}
