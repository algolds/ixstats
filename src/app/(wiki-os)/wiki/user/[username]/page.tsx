// Wiki user profiles live on the IxnayID passport — redirect to its Work tab.

import { redirect } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";

export default async function WikiUserProfileRedirect({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  redirect(withBasePath(getWikiProfilePath(decodeURIComponent(username).replace(/_/g, " "))));
}
