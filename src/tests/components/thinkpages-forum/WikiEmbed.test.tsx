import React, { useRef } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

interface MockApi {
  article: { data?: { infoboxHtml: string | null } | null; isLoading?: boolean };
  inputs: { title?: string };
}

jest.mock("~/trpc/react", () => {
  const article: MockApi["article"] = {};
  const inputs: MockApi["inputs"] = {};
  return {
    article,
    inputs,
    api: {
      wikios: {
        getArticleHtml: {
          useQuery: (input: { title: string }) => {
            inputs.title = input.title;
            return { isLoading: false, ...article };
          },
        },
      },
    },
  };
});

jest.mock("~/components/dashboard/sections/feed/InlineWikiArticlePreview", () => ({
  InlineWikiArticlePreview: ({ title }: { title: string }) => (
    <div data-testid="summary">{title}</div>
  ),
}));

import { WikiEmbeds } from "~/components/thinkpages-forum/thread/WikiEmbed";

const { article, inputs } = jest.requireMock<MockApi>("~/trpc/react");

function Harness({ html }: { html: string }) {
  const root = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={root} data-testid="root" dangerouslySetInnerHTML={{ __html: html }} />
      <WikiEmbeds root={root} />
    </>
  );
}

const embed = (kind: string, title: string, extra = "") =>
  `<div class="forum-wiki-embed" data-wiki-embed="${kind}" data-wiki-title="${title}"${extra}><a href="https://ixwiki.com/wiki/X">${title}</a></div>`;

beforeEach(() => {
  for (const key of Object.keys(article)) delete article[key as keyof typeof article];
  inputs.title = undefined;
});

describe("WikiEmbeds", () => {
  it("shows the article preview for a summary embed, keeping the plain link in the markup", async () => {
    render(<Harness html={embed("summary", "Juan Kerr")} />);
    expect(await screen.findByTestId("summary")).toHaveTextContent("Juan Kerr");
    expect(screen.getByRole("link", { name: "Juan Kerr" })).toHaveAttribute(
      "href",
      "https://ixwiki.com/wiki/X"
    );
  });

  it("shows the article's infobox for an infobox embed", async () => {
    article.data = { infoboxHtml: '<table class="infobox"><tr><td>Capital</td></tr></table>' };
    const { container } = render(<Harness html={embed("infobox", "Fiannria")} />);
    await waitFor(() => expect(container.querySelector(".forum-infobox table")).not.toBeNull());
    expect(inputs.title).toBe("Fiannria");
  });

  it("adds nothing for an infobox embed when the article has no infobox", async () => {
    article.data = { infoboxHtml: null };
    const { container } = render(<Harness html={embed("infobox", "Fiannria")} />);
    await waitFor(() => expect(inputs.title).toBe("Fiannria"));
    expect(container.querySelector(".forum-infobox")).toBeNull();
  });

  it("shows the wiki image at the given width, clamped", async () => {
    const { container } = render(
      <Harness html={embed("image", "File:JuanKerr.jpg", ' data-width="5000"')} />
    );
    await waitFor(() => expect(container.querySelector(".forum-embed-view img")).not.toBeNull());
    const img = container.querySelector<HTMLImageElement>(".forum-embed-view img")!;
    expect(img.getAttribute("src")).toMatch(/JuanKerr\.jpg$/);
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("alt")).toBe("JuanKerr.jpg");
  });

  it("shows an image embed without a width at its natural size", async () => {
    const { container } = render(<Harness html={embed("image", "File:A.png")} />);
    await waitFor(() => expect(container.querySelector(".forum-embed-view img")).not.toBeNull());
    expect(container.querySelector(".forum-embed-view img")?.hasAttribute("width")).toBe(false);
  });

  it.each([
    ["a title with markup", embed("summary", "&lt;img src=x onerror=alert(1)&gt;")],
    ["a title with a quote", embed("summary", "Say &quot;hi&quot;")],
    ["an overlong title", embed("summary", "x".repeat(300))],
    ["an image that is not a file", embed("image", "Juan Kerr")],
    ["a width that is not a number", embed("image", "File:A.png", ' data-width="12px"')],
    ["an unknown kind", embed("iframe", "Juan Kerr")],
  ])("leaves the plain link for %s", async (_, html) => {
    const { container } = render(<Harness html={html} />);
    // Let the scan run; nothing is portaled into the embed.
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector(".forum-embed-view")).toBeNull();
    expect(screen.queryByTestId("summary")).toBeNull();
    expect(container.querySelector("[data-wiki-embed] a")).not.toBeNull();
    expect(container.querySelector("img[src*='x']")).toBeNull();
  });

  it("hydrates embeds that appear after the first render (the body re-renders as React elements)", async () => {
    const { getByTestId } = render(<Harness html="<p>nothing yet</p>" />);
    const root = getByTestId("root");
    act(() => {
      root.innerHTML = embed("summary", "Late Arrival");
    });
    expect(await screen.findByTestId("summary")).toHaveTextContent("Late Arrival");
  });
});
