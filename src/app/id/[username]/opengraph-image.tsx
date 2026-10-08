import { passportOgImage } from "~/lib/og/passport-og-image";

export const alt = "IxStates Passport";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

/** The `/@handle` link card: the holder's passport document, or the generic passport card. */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return passportOgImage(username);
}
