/**
 * The pre-paint appearance script is written into the server's HTML head (with the request's nonce)
 * and is never a React `<script>` element: Next renders the tree on the client, with no hydrating,
 * for the error shell of a 404 page, and React then warns that a script it creates is never run.
 */
import "node:fs";
import "node:path";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { ServerInsertedHTMLContext } from "next/dist/shared/lib/server-inserted-html.shared-runtime";
import { AppearanceInitScript } from "~/components/providers/AppearanceInitScript";
import { APPEARANCE_INIT_SCRIPT } from "~/lib/design/appearance";

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
});
