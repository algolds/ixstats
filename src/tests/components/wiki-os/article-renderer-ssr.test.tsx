/** @jest-environment node */
/**
 * Plan 412: the reader is now server-rendered with the article in it, so ArticleRenderer and its
 * subtree must render with no `window` or `document` (this runs under the node environment, as the
 * server does), and what they render must not depend on the server's locale or time zone.
 */
import { renderToString } from "react-dom/server";

jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: false, isLoaded: false, user: null }),
}));
// A query hook that has not resolved yet (the server never waits for one): no stat values.
jest.mock("~/components/wiki-os/reader/useStatValues", () => ({ useStatValues: () => ({}) }));

import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { AuthProvider } from "~/context/auth-context";
import { MediaContextProvider } from "~/components/media/MediaContext";
import { MediaThemeProvider } from "~/components/wiki-os/shared/MediaThemeContext";

const CONTENT =
  '<p>Aurelia is a country of Eurth. See <a href="/wiki/Template:Coords:12.5,40.2,6" title="x">the capital</a> and <span class="wikios-stat-placeholder" data-key="MyCountry:gdp"></span>.</p><h2 id="Geography">Geography</h2><p>Coastal.</p>';

/** The (wiki-os) layout's providers and the root layout's, around the reader. */
export function serverRender(lastModified: string): string {
  return renderToString(
    <AuthProvider>
      <MediaContextProvider>
        <MediaThemeProvider>
          <ArticleRenderer
            title="Aurelia"
            contentHtml={CONTENT}
            infoboxHtml={null}
            noticesHtml={null}
            toc={[{ id: "Geography", text: "Geography", level: 2 }]}
            categories={["Countries"]}
            lastModified={lastModified}
            wikiSource="ixwiki"
            authorInfo={null}
          />
        </MediaThemeProvider>
      </MediaContextProvider>
    </AuthProvider>
  );
}

describe("ArticleRenderer on the server", () => {
  it("renders the article's own HTML with no browser globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");

    const html = serverRender("2026-09-01T23:30:00.000Z");

    expect(html).toContain("Aurelia is a country of Eurth");
    expect(html).toContain("Geography");
    expect(html).toContain("Countries");
  });

  it("sends the article as MediaWiki rendered it: the placeholder pass needs a DOM and runs after hydration", () => {
    const html = serverRender("2026-09-01T23:30:00.000Z");

    expect(html).toContain('href="/wiki/Template:Coords:12.5,40.2,6"');
    expect(html).not.toContain("wikios-coords-placeholder");
  });

  it("shows dates in UTC and en-US whatever the server's time zone, so the browser's pass matches", () => {
    const saved = process.env.TZ;
    process.env.TZ = "Pacific/Auckland"; // already 2 September there
    try {
      const html = serverRender("2026-09-01T23:30:00.000Z");
      expect(html).toContain("Sep 1, 2026");
      expect(html).not.toContain("Sep 2, 2026");
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  });
});
