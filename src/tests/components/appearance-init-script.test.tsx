/**
 * The pre-paint appearance script is written into the server's HTML head (with the request's nonce)
 * and is never a React `<script>` element: Next renders the tree on the client, with no hydrating,
 * for the error shell of a 404 page, and React then warns that a script it creates is never run.
 */
import "node:fs";
import "node:path";
import { render } from "@testing-library/react";
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

  it("writes the script once: Next calls the callback again for every chunk it flushes", () => {
    const inserted: Array<() => React.ReactNode> = [];
    renderToString(
      <ServerInsertedHTMLContext.Provider value={(callback) => inserted.push(callback)}>
        <AppearanceInitScript nonce="abc123" />
      </ServerInsertedHTMLContext.Provider>
    );

    const calls = [inserted[0]!(), inserted[0]!(), inserted[0]!()];
    expect(renderToStaticMarkup(<>{calls[0]}</>)).toContain("<script");
    expect(renderToStaticMarkup(<>{calls[1]}</>)).toBe("");
    expect(renderToStaticMarkup(<>{calls[2]}</>)).toBe("");
  });

  it("creates no script when the client renders it (no hydrating), and does not warn", () => {
    const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(<AppearanceInitScript nonce="abc123" />);

    expect(container.querySelector("script")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
