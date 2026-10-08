import { realmOgImage } from "~/lib/og/realm-og-image";

export const alt = "Realm on IxStates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

/**
 * The stable download URL of the realm card, `/r/{realm}/opengraph-image`, for the share sheet's
 * Download card. The `(region)` group's own `opengraph-image.tsx` is served at a hashed URL and stays
 * the closer one for those pages' og:image.
 */
export default async function Image({ params }: { params: Promise<{ realm: string }> }) {
  return realmOgImage((await params).realm);
}
