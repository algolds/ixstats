/** @jest-environment node */
/**
 * `siteMetadataBase`: the absolute base Next resolves canonical, og:url and OG image URLs against.
 * Origin only, because file-based OG image URLs already carry the base path and Next appends every
 * relative URL to `metadataBase.pathname` (a base path there would be doubled).
 */
import { describe, expect, it } from "@jest/globals";
import { resolveUrl } from "next/dist/lib/metadata/resolvers/resolve-url";
import { orNullLogged, siteMetadataBase } from "~/lib/site-metadata";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

describe("siteMetadataBase", () => {
  it("uses the origin of the public app URL", () => {
    expect(siteMetadataBase("https://example.org").href).toBe("https://example.org/");
    expect(siteMetadataBase("https://example.org/projects/ixstates/").href).toBe(
      "https://example.org/"
    );
    expect(siteMetadataBase("http://localhost:3000").href).toBe("http://localhost:3000/");
  });

  it("falls back to the wiki's host when the URL is missing or invalid", () => {
    const wikiHost = `${new URL(mediaWikiOrigin()).origin}/`;
    expect(siteMetadataBase(undefined).href).toBe(wikiHost);
    expect(siteMetadataBase("").href).toBe(wikiHost);
    expect(siteMetadataBase("false").href).toBe(wikiHost);
  });

  it("lets Next resolve base-path'd page and OG image URLs without doubling the base path", () => {
    const base = siteMetadataBase("https://example.org");
    expect(resolveUrl("/projects/ixstates/@alex", base).href).toBe(
      "https://example.org/projects/ixstates/@alex"
    );
    // File-based OG image URLs arrive with the base path already in front.
    expect(resolveUrl("/projects/ixstates/id/alex/opengraph-image?1", base).href).toBe(
      "https://example.org/projects/ixstates/id/alex/opengraph-image?1"
    );
  });
});

describe("orNullLogged", () => {
  it("passes a value through", async () => {
    await expect(orNullLogged(Promise.resolve(3), "x")).resolves.toBe(3);
  });

  it("logs a failure with the [metadata] prefix and returns null", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      orNullLogged(Promise.reject(new Error("boom")), "realm eurth")
    ).resolves.toBeNull();
    expect(logged).toHaveBeenCalledWith(
      "[metadata] realm eurth failed:",
      expect.objectContaining({ message: "boom" })
    );
    logged.mockRestore();
  });
});
