/**
 * The pre-paint appearance script is written into the server's HTML head (with the request's nonce, so the CSP lets
 * it run) and is never a React `<script>` element: Next renders the tree on the client, with no hydrating, for the
 * error shell of a 404 page, and React then warns that a script it creates is never run. The script is a constant:
 * nothing a reader stored is ever written into its text. Folds lib/design/appearance.test.ts.
 */
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { ServerInsertedHTMLContext } from "next/dist/shared/lib/server-inserted-html.shared-runtime";
import { AppearanceInitScript } from "~/components/providers/AppearanceInitScript";
import { APPEARANCE_INIT_SCRIPT, MEDIA_THEME_KEY } from "~/lib/design/appearance";

describe("AppearanceInitScript", () => {
  it("hands the server the script, with the nonce, and renders nothing itself", () => {
    const inserted: Array<() => React.ReactNode> = [];
    const html = renderToString(
      <ServerInsertedHTMLContext.Provider value={(callback) => inserted.push(callback)}>
        <AppearanceInitScript nonce="abc123" />
      </ServerInsertedHTMLContext.Provider>
    );

    expect(html).toBe("");
    expect(inserted).toHaveLength(1);
    const markup = renderToStaticMarkup(<>{inserted[0]!()}</>);
    expect(markup.startsWith('<script nonce="abc123">')).toBe(true);
    expect(markup).toContain(APPEARANCE_INIT_SCRIPT.slice(0, 60));
  });

  it("is a constant: a value a reader stored never reaches the script text", () => {
    localStorage.setItem(MEDIA_THEME_KEY, "plinth-marker-9f2c");
    expect(APPEARANCE_INIT_SCRIPT).not.toContain("plinth-marker-9f2c");
    expect(APPEARANCE_INIT_SCRIPT).toContain(JSON.stringify(MEDIA_THEME_KEY));
    localStorage.clear();
  });
});
