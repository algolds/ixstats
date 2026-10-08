/** @jest-environment node */
/**
 * The realm card has a stable URL, `/r/{realm}/opengraph-image`, outside the `(region)` route group
 * (Next serves a group's metadata image at a hashed `opengraph-image-<hash>` path, which the share
 * sheet cannot know). Both routes draw the same card; the group keeps its own for its og:image.
 */
import fs from "node:fs";
import path from "node:path";

const mockRealmOgImage = jest.fn((slug: string) => Promise.resolve(`card:${slug}`));
jest.mock("~/lib/og/realm-og-image", () => ({
  realmOgImage: (slug: string) => mockRealmOgImage(slug),
}));

import { describe, expect, it } from "@jest/globals";
import StableImage from "~/app/r/[realm]/opengraph-image";
import RegionImage from "~/app/r/[realm]/(region)/opengraph-image";

const APP = path.join(process.cwd(), "src/app/r/[realm]");

describe("realm card routes", () => {
  it("serve the share sheet's stable path outside the route group", () => {
    expect(fs.existsSync(path.join(APP, "opengraph-image.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(APP, "(region)", "opengraph-image.tsx"))).toBe(true);
  });

  it("draw the same realm card for the slug", async () => {
    await expect(StableImage({ params: Promise.resolve({ realm: "eurth" }) })).resolves.toBe(
      "card:eurth"
    );
    await expect(RegionImage({ params: Promise.resolve({ realm: "eurth" }) })).resolves.toBe(
      "card:eurth"
    );
  });
});
