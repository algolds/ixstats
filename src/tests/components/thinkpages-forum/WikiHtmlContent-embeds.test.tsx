import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

let mockMissing: string[] | undefined;

jest.mock("~/trpc/react", () => ({
  api: { wikios: { getMissingPages: { useQuery: () => ({ data: mockMissing }) } } },
}));
// Next's own rule for a <Link>'s href (it prefixes the base path and never checks for one already there), with the
// base path read per call instead of once at build time.
jest.mock("next/dist/client/add-base-path", () => {
  const { addPathPrefix } = jest.requireActual<{
    addPathPrefix: (path: string, prefix: string) => string;
  }>("next/dist/shared/lib/router/utils/add-path-prefix");
  return {
    addBasePath: (path: string) => addPathPrefix(path, process.env.NEXT_PUBLIC_BASE_PATH ?? ""),
  };
});

import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
describe("WikiHtmlContent attributes", () => {
  it("keeps an image's width and height, and still drops other data attributes and event handlers", async () => {
    const html =
      '<p data-other="x" onclick="alert(1)"><img src="https://x/y.png" alt="" width="320" height="200" onerror="alert(2)" data-other="y"><a href="https://e.com/" onmouseover="alert(3)">l</a></p>';
    const { container } = render(<WikiHtmlContent html={html} />);
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("320");
    expect(img.getAttribute("height")).toBe("200");
    const names = Array.from(container.querySelectorAll("*")).flatMap((el) =>
      el.getAttributeNames()
    );
    expect(names.filter((name) => name.startsWith("on") || name.startsWith("data-"))).toEqual([]);
  });
});

describe("WikiHtmlContent links under the base path", () => {
  const saved = process.env.NEXT_PUBLIC_BASE_PATH;
  const html =
    '<p>See <a href="/wiki/Foo" title="Foo">Foo</a>, <a href="/dashboard/feed">the feed</a> and ' +
    '<a href="/projects/ixstates/dashboard/accounts">accounts</a>.</p>';

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = saved;
  });

  /** The link once WikiHtmlContent has mounted and drawn its own links (a wiki link gets its reader classes). */
  async function mountedLink(container: HTMLElement, name: string): Promise<HTMLAnchorElement> {
    const find = () =>
      Array.from(container.querySelectorAll("a")).find((a) => a.textContent === name);
    await waitFor(() => expect(container.querySelector("a.text-tint")).not.toBeNull());
    return find()!;
  }

  it("WikiHtmlContent renders a /wiki/ link as a Link with the bare path and the base path in the DOM", async () => {
    const { container } = render(<WikiHtmlContent html={html} />);
    const link = await mountedLink(container, "Foo");
    expect(link.getAttribute("href")).toBe("/projects/ixstates/wiki/Foo");
    expect(link.getAttribute("title")).toBeNull();
    expect((await mountedLink(container, "the feed")).getAttribute("href")).toBe(
      "/projects/ixstates/dashboard/feed"
    );
    expect((await mountedLink(container, "accounts")).getAttribute("href")).toBe(
      "/projects/ixstates/dashboard/accounts"
    );
    expect(container.innerHTML).not.toContain("/projects/ixstates/projects/ixstates");
  });

  it("before mount the raw markup carries the base path", () => {
    const markup = renderToString(<WikiHtmlContent html={html} />);
    expect(markup).toContain('href="/projects/ixstates/wiki/Foo"');
    expect(markup).toContain('href="/projects/ixstates/dashboard/feed"');
    expect(markup).toContain('href="/projects/ixstates/dashboard/accounts"');
    expect(markup).not.toContain("/projects/ixstates/projects/ixstates");
  });

  it("with no base path a link keeps its bare path, before and after mount", async () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(renderToString(<WikiHtmlContent html={html} />)).toContain('href="/wiki/Foo"');
    const { container } = render(<WikiHtmlContent html={html} />);
    expect((await mountedLink(container, "Foo")).getAttribute("href")).toBe("/wiki/Foo");
  });

  it("marks a link to a missing page red, with its title, from the bare path", async () => {
    mockMissing = ["Foo"];
    const { container } = render(<WikiHtmlContent html={html} />);
    await waitFor(() => expect(container.querySelector("a.text-destructive")).not.toBeNull());
    const link = container.querySelector("a.text-destructive")!;
    expect(link.getAttribute("href")).toBe("/projects/ixstates/wiki/Foo");
    expect(link.getAttribute("title")).toBe("Foo (page does not exist)");
    mockMissing = undefined;
  });
});

describe("WikiHtmlContent wiki embed cards", () => {
  const embedHtml = (source: string, imageUrl: string, title = "Pax Atomica") =>
    `<div data-wikiembed="true" data-title="${title}" data-summary="A peace." data-imageurl="${imageUrl}" data-source="${source}"></div>`;

  async function mountedCard(html: string): Promise<HTMLAnchorElement> {
    const { container } = render(<WikiHtmlContent html={html} />);
    await waitFor(() => expect(container.querySelector("h4")).not.toBeNull());
    return container.querySelector("h4")!.closest("a")!;
  }

  it("an althistory embed card says From AltHistory Wiki, links with ?source=althistory, and its image goes through the media proxy", async () => {
    const card = await mountedCard(
      embedHtml(
        "althistory",
        "https://static.wikia.nocookie.net/althistory/images/a/ab/Pax.png/revision/latest?cb=1"
      )
    );
    expect(card.getAttribute("href")).toBe("/wiki/Pax_Atomica?source=althistory");
    expect(card.textContent).toContain("From AltHistory Wiki");
    expect(card.querySelector(".text-eyebrow")).toBeNull();
    expect(card.querySelector("img")?.getAttribute("src")).toBe(
      "/api/mediawiki/althistory/wiki/Special:FilePath/Pax.png"
    );
  });

  it("an iiwiki embed card names IIWiki, and its own-host image loads through its proxy", async () => {
    const card = await mountedCard(embedHtml("iiwiki", "https://iiwiki.com/images/a/ab/Flag.png"));
    expect(card.getAttribute("href")).toBe("/wiki/Pax_Atomica?source=iiwiki");
    expect(card.textContent).toContain("From IIWiki");
    expect(card.querySelector("img")?.getAttribute("src")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Flag.png"
    );
  });

  it.each([
    ["another host", "https://evil.example/track.png"],
    ["the other sister's host", "https://iiwiki.com/images/a/ab/Flag.png"],
    ["a javascript: URL", "javascript:alert(1)"],
  ])("an off-host embed image is not shown (%s)", async (_label, imageUrl) => {
    const card = await mountedCard(embedHtml("althistory", imageUrl));
    expect(card.querySelector("img")).toBeNull();
  });

  it("an IxWiki embed card says From IxWiki, links the bare path and keeps its image", async () => {
    const card = await mountedCard(embedHtml("ixwiki", "https://ixwiki.com/images/a/ab/Port.png"));
    expect(card.getAttribute("href")).toBe("/wiki/Pax_Atomica");
    expect(card.textContent).toContain("From IxWiki");
    expect(card.textContent).not.toContain("WikiOS");
    expect(card.querySelector("img")?.getAttribute("src")).toBe(
      "https://ixwiki.com/images/a/ab/Port.png"
    );
  });

  it("an embed whose title would climb out of /wiki/ shows its card with no link", async () => {
    const { container } = render(<WikiHtmlContent html={embedHtml("iiwiki", "", "..")} />);
    await waitFor(() => expect(container.querySelector("h4")).not.toBeNull());
    expect(container.querySelector("h4")?.textContent).toBe("..");
    expect(container.querySelector("a")).toBeNull();
  });

  it.each([
    ["another host", "https://evil.example/track.png"],
    ["a sister host", "https://iiwiki.com/images/a/ab/Flag.png"],
    ["IxWiki's host outside its files", "https://ixwiki.com/projects/ixstates/api/x"],
  ])("an IxWiki embed image on %s is not shown", async (_label, imageUrl) => {
    const card = await mountedCard(embedHtml("ixwiki", imageUrl));
    expect(card.querySelector("img")).toBeNull();
  });

  it("an IxWiki embed image that is a same-origin upload loads from the app", async () => {
    const card = await mountedCard(embedHtml("ixwiki", "/images/uploads/uploaded_1.png"));
    expect(card.querySelector("img")?.getAttribute("src")).toBe("/images/uploads/uploaded_1.png");
  });

  it("an embed whose source the reader does not know renders as IxWiki's", async () => {
    const card = await mountedCard(embedHtml("evil", ""));
    expect(card.getAttribute("href")).toBe("/wiki/Pax_Atomica");
    expect(card.textContent).toContain("From IxWiki");
    expect(card.querySelector("img")).toBeNull();
  });
});

describe("WikiHtmlContent sister links and the missing-page check", () => {
  it("a link to a sister page is never marked red from IxWiki's missing pages", async () => {
    mockMissing = ["Gallambria"];
    const html =
      '<p><a href="/wiki/Gallambria?source=iiwiki">G</a> <a href="/wiki/Gallambria">H</a></p>';
    const { container } = render(<WikiHtmlContent html={html} />);
    await waitFor(() => expect(container.querySelector("a.text-destructive")).not.toBeNull());
    const red = Array.from(container.querySelectorAll("a.text-destructive"));
    expect(red.map((a) => a.textContent)).toEqual(["H"]);
    mockMissing = undefined;
  });
});
