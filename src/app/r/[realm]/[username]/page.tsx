import { permanentRedirect } from "next/navigation";

/** The realm passport moved to `/r/{realm}/@{handle}`; the old `/r/{realm}/{username}` path 301s there. */
export default async function LegacyRealmPassportPage({
  params,
}: {
  params: Promise<{ realm: string; username: string }>;
}) {
  const { realm, username } = await params;
  const handle = decodeURIComponent(username).replace(/^@/, "");
  permanentRedirect(`/r/${realm}/@${encodeURIComponent(handle)}`);
}
