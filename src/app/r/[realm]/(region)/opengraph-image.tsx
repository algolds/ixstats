import { realmOgImage } from "~/lib/og/realm-og-image";

export const alt = "Realm on IxStates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

/**
 * The `/r/{realm}` link card (and its board, nations and rules pages) for their metadata. Inside the
 * route group Next serves it at a hashed URL (`opengraph-image-<hash>`); the share sheet downloads the
 * same card from the stable `/r/{realm}/opengraph-image` (`../opengraph-image.tsx`).
 */
export default async function Image({ params }: { params: Promise<{ realm: string }> }) {
  return realmOgImage((await params).realm);
}
