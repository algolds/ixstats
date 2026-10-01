/** @jest-environment node */
/**
 * The nginx takeover kit and the app's standalone allowlist say the same about /images/: WikiOS
 * serves /images/wikios, /images/flags and /images/uploads (a country's uploaded flag, which the Main
 * Page shows), and everything else under /images/ (MediaWiki's /images/<a>/<ab>/, /images/thumb/)
 * stays with the existing `location /images/`, which the takeover file must not define.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WIKIOS_ALLOWED_PREFIXES } from "~/lib/system/wikios-standalone";

const conf = readFileSync(join(process.cwd(), "scripts/ops/nginx/wikios-takeover.conf"), "utf8")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

/** The `location` directives of the file with the body of each block. */
const locations = [...conf.matchAll(/^location\s+(\S+(?:\s+\S+)?)\s*\{([^}]*)\}/gm)].map(
  (match) => ({
    head: match[1]!,
    body: match[2]!,
  })
);

describe("wikios-takeover.conf under /images/", () => {
  it.each(["/images/flags/", "/images/uploads/"])("sends %s to WikiOS", (prefix) => {
    const block = locations.find((location) => location.head === `^~ ${prefix}`);

    expect(block).toBeDefined();
    expect(block!.body).toContain("proxy_pass http://wikios;");
  });

  it("sends /images/wikios* to WikiOS", () => {
    expect(locations.find((location) => location.head === "^~ /images/wikios")).toBeDefined();
  });

  it("does not take /images/ itself, MediaWiki's uploads and thumbnails stay where they are", () => {
    const imageLocations = locations
      .map((location) => location.head)
      .filter((head) => /\/images\b/.test(head));

    expect(imageLocations.sort()).toEqual(
      ["^~ /images/flags/", "^~ /images/uploads/", "^~ /images/wikios"].sort()
    );
  });

  it("routes every /images prefix the app allows", () => {
    const allowed = WIKIOS_ALLOWED_PREFIXES.filter((prefix) => prefix.startsWith("/images/"));

    expect([...allowed].sort()).toEqual(["/images/flags", "/images/uploads", "/images/wikios"]);
    for (const prefix of allowed) {
      expect(locations.some((location) => location.head.startsWith(`^~ ${prefix}`))).toBe(true);
    }
  });
});
