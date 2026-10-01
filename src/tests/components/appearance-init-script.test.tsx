/**
 * The pre-paint appearance script is written into the server's HTML head (with the request's nonce)
 * and is never a React `<script>` element: Next renders the tree on the client, with no hydrating,
 * for the error shell of a 404 page, and React then warns that a script it creates is never run.
 */
import fs from "node:fs";
import path from "node:path";
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

/**
 * Whether source code renders an executable `<script>` element: not in a comment, and not a JSON-LD
 * data block (`type="application/ld+json"`), which a server component may write and which nothing runs.
 */
function rendersExecutableScript(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  return /<script\b(?![^>]*application\/ld\+json)/.test(code);
}

describe("rendersExecutableScript (the guard's own matcher)", () => {
  it("finds a script element, whatever its attributes", () => {
    expect(rendersExecutableScript('<script src="/x.js" />')).toBe(true);
    expect(rendersExecutableScript("<script dangerouslySetInnerHTML={{ __html: code }} />")).toBe(
      true
    );
    expect(rendersExecutableScript("<div>\n  <script\n    nonce={nonce}\n  />\n</div>")).toBe(true);
  });

  it("allows a JSON-LD data block", () => {
    expect(
      rendersExecutableScript(
        '<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />'
      )
    ).toBe(false);
    expect(
      rendersExecutableScript(
        "<script\n  id=\"ld\"\n  type='application/ld+json'\n  dangerouslySetInnerHTML={{ __html: json }}\n/>"
      )
    ).toBe(false);
  });

  it("ignores a script named in a comment", () => {
    expect(
      rendersExecutableScript("// the layout used to render a <script> here\nconst a = 1;")
    ).toBe(false);
    expect(rendersExecutableScript("/* <script src='x' /> */ const a = 1;")).toBe(false);
    expect(rendersExecutableScript("<div>{/* a <script> would warn */}</div>")).toBe(false);
    expect(rendersExecutableScript("const a = 1; // <script>\nconst b = 2;")).toBe(false);
  });

  it("does not take a URL's slashes for a comment", () => {
    expect(rendersExecutableScript('const a = "https://x.test/"; <script src="/x.js" />')).toBe(
      true
    );
  });
});

describe("the app's components", () => {
  /** The one place a script is written: into the server's stream only (see above). */
  const SERVER_INSERTED = "src/components/providers/AppearanceInitScript.tsx";
  const scripts: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        entry.name.endsWith(".tsx") &&
        rendersExecutableScript(fs.readFileSync(full, "utf8"))
      ) {
        const file = path.relative(process.cwd(), full);
        if (file !== SERVER_INSERTED) scripts.push(file);
      }
    }
  };

  it("render no executable `<script>` element: the tree is sometimes rendered by the client alone, where it never runs", () => {
    walk(path.join(process.cwd(), "src/app"));
    walk(path.join(process.cwd(), "src/components"));
    expect(scripts).toEqual([]);
  });
});
