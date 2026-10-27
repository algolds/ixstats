/**
 * The composer shows a wiki link as a plain `<a>` to the reader on the link's wiki (`createUrl` adds the base path),
 * and a title no link may name (`..`) as text with no href.
 */
import React from "react";
import { render } from "@testing-library/react";
// platejs is ESM-only and not loadable here: a plugin is its config, so `render.node` is the component as written.
jest.mock("platejs/react", () => ({ createPlatePlugin: <T,>(config: T): T => config }));

import { WikiLinkPlugin } from "~/components/shared/editor/EditorPlugins";
import type { WikiLinkElement } from "~/components/shared/editor/SlateSerializer";
import { publicArticleUrl } from "~/lib/wiki-os/config";

type RenderNode = (props: {
  attributes: React.AnchorHTMLAttributes<HTMLAnchorElement>;
  children: React.ReactNode;
  element: WikiLinkElement;
}) => React.ReactElement;

function renderLink(element: WikiLinkElement): HTMLAnchorElement {
  const Node = WikiLinkPlugin.render.node as RenderNode;
  const { container } = render(
    <Node attributes={{ id: "slate" }} element={element}>
      {element.target}
    </Node>
  );
  return container.querySelector("a")!;
}

describe("WikiLinkPlugin", () => {
  it("links a sister page in the reader with its source", () => {
    const a = renderLink({
      type: "wikilink",
      target: "Gallambria Republic",
      source: "iiwiki",
      children: [{ text: "G" }],
    });
    expect(a.getAttribute("href")).toBe("/wiki/Gallambria_Republic?source=iiwiki");
    expect(a.id).toBe("slate");
  });

  it("links an IxWiki page by its bare path", () => {
    const a = renderLink({ type: "wikilink", target: "Port of Ixnay", children: [{ text: "P" }] });
    expect(a.getAttribute("href")).toBe("/wiki/Port_of_Ixnay");
  });

  it("links a page the reader does not read as an article to that wiki's own page, in a new tab", () => {
    const a = renderLink({
      type: "wikilink",
      target: "User talk:Kir",
      source: "iiwiki",
      children: [{ text: "talk" }],
    });
    expect(a.getAttribute("href")).toBe(publicArticleUrl("User talk:Kir", "iiwiki"));
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("a reader link opens in place", () => {
    const a = renderLink({ type: "wikilink", target: "Foo", children: [{ text: "F" }] });
    expect(a.hasAttribute("target")).toBe(false);
  });

  it("gives a title that would climb out of /wiki/ no href", () => {
    const a = renderLink({
      type: "wikilink",
      target: "..",
      source: "iiwiki",
      children: [{ text: "x" }],
    });
    expect(a.hasAttribute("href")).toBe(false);
    expect(a.textContent).toBe("..");
  });
});
