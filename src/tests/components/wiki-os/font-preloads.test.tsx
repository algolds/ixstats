/** @jest-environment node */
/**
 * The reader preloads the Schibsted Grotesk weights its first screen is set in, as <link>s in the
 * HTML (so the page is not first laid out in the fallback face and moved when Schibsted arrives), and
 * each preloaded file is one the stylesheet really asks for, under the same URL.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { FontPreloads } from "~/components/wiki-os/shared/FontPreloads";

const typography = readFileSync(join(process.cwd(), "src/styles/typography.css"), "utf8");

function preloads(): Array<{ href: string; tag: string }> {
  const html = renderToString(
    <html>
      <head>
        <FontPreloads />
      </head>
      <body />
    </html>
  );
  return [...html.matchAll(/<link rel="preload"[^>]*>/g)].map((match) => ({
    tag: match[0],
    href: /href="([^"]+)"/.exec(match[0])![1]!,
  }));
}

describe("FontPreloads", () => {
  it("writes a font preload <link> for each of the four weights", () => {
    const links = preloads();

    expect(links.map((link) => link.href)).toEqual([
      "/fonts/Schibsted%20Grotesk-500.ttf",
      "/fonts/Schibsted%20Grotesk-600.ttf",
      "/fonts/Schibsted%20Grotesk-700.ttf",
      "/fonts/Schibsted%20Grotesk-800.ttf",
    ]);
    for (const { tag } of links) {
      expect(tag).toContain('as="font"');
      expect(tag).toContain('type="font/ttf"');
      expect(tag).toContain("crossorigin"); // a font is fetched in CORS mode: without it the preload is not reused
    }
  });

  it("preloads files the stylesheet declares, at the weight it declares them", () => {
    for (const { href } of preloads()) {
      const file = decodeURIComponent(href.replace("/fonts/", ""));
      const weight = /-(\d+)\.ttf$/.exec(file)![1]!;
      const face = new RegExp(
        `font-family: "Schibsted Grotesk";\\s*src: url\\("/fonts/${file}"\\) format\\("truetype"\\);\\s*font-weight: ${weight};\\s*font-style: normal;`
      );
      expect(typography).toMatch(face);
    }
  });
});
