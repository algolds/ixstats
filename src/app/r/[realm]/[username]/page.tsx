import { notFound, permanentRedirect } from "next/navigation";
import { passportSegmentHandle, segmentHasAt } from "~/lib/passport/passport-segment";

/**
 * The realm passport moved to `/r/{realm}/@{handle}`; the old `/r/{realm}/{username}` path 308s there.
 * A segment that already starts with `@` (or `%40`) is the new path that missed its rewrite, and a
 * malformed one names nobody: both 404 rather than redirect to themselves.
 */
export default async function LegacyRealmPassportPage({
  params,
}: {
  params: Promise<{ realm: string; username: string }>;
}) {
  const { realm, username } = await params;
  const handle = segmentHasAt(username) ? null : passportSegmentHandle(username);
  if (!handle) notFound();
  permanentRedirect(`/r/${realm}/@${encodeURIComponent(handle)}`);
}
