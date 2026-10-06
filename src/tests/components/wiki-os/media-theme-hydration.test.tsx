/**
 * The hero's picture is themed (inverted or plated for the dark theme) and the server cannot know
 * the reader's theme or stored media mode. The markup must therefore not depend on either: a
 * light-theme reader whose stored mode is plinth hydrates the HTML a default (dark, auto) render
 * produced without a mismatch, and the theme is left to the stylesheet (foundations.css), which
 * reads <html>, so there is no frame of the wrong theme either.
 */
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { WikiOSHeader } from "~/components/wiki-os/reader/ArticleHeader";
import { MediaThemeProvider } from "~/components/wiki-os/shared/MediaThemeContext";
import { MEDIA_THEME_STORAGE_KEY } from "~/lib/wiki-os/transformers/media-theme";

jest.mock("react-dom", () => ({ ...jest.requireActual("react-dom"), preload: jest.fn() }));
jest.mock("~/components/wiki-os/reader/CategoryBreadcrumb", () => ({
  CategoryBreadcrumb: () => null,
}));
jest.mock("~/components/wiki-os/reader/WatchButton", () => ({ WatchButton: () => null }));
jest.mock("~/components/wiki-os/reader/headers/EditorialMastheadHeader", () => ({
  EditorialMastheadHeader: () => <div data-testid="masthead" />,
}));

const SVG = "/api/mediawiki/ixwiki/images/a/ab/Coat_of_arms.svg";
const PHOTO = "/api/mediawiki/ixwiki/images/a/ab/Harbour.jpg";

const tree = (featuredImageUrl: string) => (
  <MediaThemeProvider>
    <WikiOSHeader
      title="Aurelia"
      lastModified={null}
      featuredImageUrl={featuredImageUrl}
      featuredImageFile={{ width: 3000, height: 2000 }}
      tocLength={0}
      onTocClick={() => undefined}
    />
  </MediaThemeProvider>
);

/** What the reader's browser is like when the page's scripts start: the root theme and the stored mode. */
function setBrowser(theme: "light" | "dark", storedMode: "auto" | "plinth") {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(MEDIA_THEME_STORAGE_KEY, storedMode);
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-media-theme");
  localStorage.clear();
});

describe("a themed hero picture", () => {
  it.each([
    ["a vector picture", SVG, "svg"],
    ["a photograph", PHOTO, "photo"],
  ])(
    "%s hydrates the server's HTML for a light-theme reader whose mode is plinth",
    async (_name, url, kind) => {
      setBrowser("dark", "auto"); // what the server's render is made for: the defaults
      const container = document.createElement("div");
      document.body.appendChild(container);
      container.innerHTML = renderToString(tree(url));
      const sent = container.innerHTML;

      setBrowser("light", "plinth"); // what the reader's browser is
      const recoverable = jest.fn();
      const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
      await act(async () => {
        hydrateRoot(container, tree(url), { onRecoverableError: recoverable });
      });

      expect(recoverable).not.toHaveBeenCalled();
      expect(errors.mock.calls.filter((call) => String(call[0]).includes("hydrat"))).toHaveLength(
        0
      );
      // the first client render is what was sent: nothing was patched up
      expect(container.innerHTML).toBe(sent);
      // and the reader's own mode is applied once hydrated, for the stylesheet to read
      expect(document.documentElement.getAttribute("data-media-theme")).toBe("plinth");
      // the picture is described, not styled: no inline filter, plate, padding or radius
      const picture = container.querySelector("img")!;
      expect(picture.getAttribute("style")).toBeNull();
      expect(container.querySelector(`[data-media-kind="${kind}"]`)).not.toBeNull();
      expect(container.querySelector("[data-media-mode]")).toBeNull();
      errors.mockRestore();
      container.remove();
    }
  );

  it("is the same markup whatever the reader's theme and stored mode", () => {
    setBrowser("dark", "auto");
    const dark = renderToString(tree(SVG));
    setBrowser("light", "plinth");
    const light = renderToString(tree(SVG));
    expect(light).toBe(dark);
  });
});
