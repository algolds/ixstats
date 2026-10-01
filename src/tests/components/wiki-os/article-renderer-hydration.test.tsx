/**
 * Plan 412: the browser hydrates the server's HTML of an article. The first pass must be the HTML the
 * server sent (no hydration mismatch), and the reader's placeholder pass, which needs a DOM, must
 * then be applied, or a page's coordinate links and map embeds would stay plain links forever.
 */
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isSignedIn: false, isLoaded: false, user: null }),
}));
jest.mock("~/components/wiki-os/reader/useStatValues", () => ({ useStatValues: () => ({}) }));

import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { AuthProvider } from "~/context/auth-context";
import { MediaContextProvider } from "~/components/media/MediaContext";
import { MediaThemeProvider } from "~/components/wiki-os/shared/MediaThemeContext";

const CONTENT =
  '<p>Aurelia is a country of Eurth. See <a href="/wiki/Template:Coords:12.5,40.2,6" title="x">the capital</a>.</p>';

const tree = () => (
  <AuthProvider>
    <MediaContextProvider>
      <MediaThemeProvider>
        <ArticleRenderer
          title="Aurelia"
          contentHtml={CONTENT}
          infoboxHtml={null}
          noticesHtml={null}
          toc={[]}
          categories={[]}
          lastModified="2026-09-01T00:00:00.000Z"
          wikiSource="ixwiki"
          authorInfo={null}
        />
      </MediaThemeProvider>
    </MediaContextProvider>
  </AuthProvider>
);

describe("hydrating a server-rendered article", () => {
  it("starts from the server's HTML without a mismatch and then mounts the placeholders", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(tree()); // what the server sent
    expect(container.querySelector(".wikios-coords-placeholder")).toBeNull();
    expect(container.querySelector('a[href="/wiki/Template:Coords:12.5,40.2,6"]')).not.toBeNull();

    const recoverable = jest.fn();
    const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await act(async () => {
      hydrateRoot(container, tree(), { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(errors.mock.calls.filter((call) => String(call[0]).includes("hydrat"))).toHaveLength(0);
    // After hydration the placeholder pass has been applied to the article.
    expect(container.querySelector(".wikios-coords-placeholder")).not.toBeNull();
    expect(container.querySelector('a[href="/wiki/Template:Coords:12.5,40.2,6"]')).toBeNull();
    errors.mockRestore();
  });
});
