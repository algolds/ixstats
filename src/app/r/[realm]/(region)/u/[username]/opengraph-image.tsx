import { passportOgImage } from "~/lib/og/passport-og-image";

export const alt = "IxStates Passport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

/**
 * The realm passport `/r/{realm}/@handle` unfurls as the person, like its metadata: this replaces
 * the realm card the `(region)` segment would otherwise attach.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ realm: string; username: string }>;
}) {
  const { username } = await params;
  return passportOgImage(username);
}
