import { legacyRefFor } from "~/lib/thinkpages-forum/legacy-forum";
import { followLegacyRedirect } from "../../legacy-gate";
import MemberProfileClient from "./MemberProfileClient";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  await followLegacyRedirect(legacyRefFor("member", userId));
  return <MemberProfileClient />;
}
