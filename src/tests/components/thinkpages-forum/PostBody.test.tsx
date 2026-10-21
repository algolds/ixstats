import { render, screen } from "@testing-library/react";

jest.mock("~/lib/base-path", () => ({
  ...jest.requireActual<typeof import("~/lib/base-path")>("~/lib/base-path"),
  withBasePath: (path: string) => (path.startsWith("/p/") ? path : `/p${path}`),
}));

// WikiHtmlContent reads missing wiki pages through tRPC; its markup is all these tests need.
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html, className }: { html: string; className?: string }) => (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));
jest.mock("~/components/thinkpages-forum/thread/WikiEmbed", () => ({
  WikiEmbeds: () => null,
}));

import { PostBody } from "~/components/thinkpages-forum/thread/PostBody";
import type { ActionCardData } from "~/components/action-links";

function card(id: string, title: string): ActionCardData {
  return { id, title, type: "diplomatic", createdAt: new Date(0), country: null };
}

const NO_CARDS = new Map<string, ActionCardData>();

describe("PostBody", () => {
  it("renders text before, between and after two tokens in order, with two cards", () => {
    const cardMap = new Map([
      ["a1", card("a1", "First action")],
      ["b2", card("b2", "Second action")],
    ]);
    const { container } = render(
      <PostBody
        html="<p>before</p>[ixaction=a1]<p>between</p>[ixaction=b2]<p>after</p>"
        style="ooc"
        cards={cardMap}
        cardsReady
      />
    );
    expect(screen.getAllByLabelText("Verified action")).toHaveLength(2);
    const text = container.textContent ?? "";
    const order = ["before", "First action", "between", "Second action", "after"].map((s) =>
      text.indexOf(s)
    );
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });
  it("renders Unverified action for an unknown id", () => {
    render(<PostBody html="<p>hi</p>[ixaction=gone]" style="ooc" cards={NO_CARDS} />);
    expect(screen.getByText("Unverified action")).toBeInTheDocument();
  });
  it("says Action unavailable when the batch failed", () => {
    render(
      <PostBody html="[ixaction=a1]" style="ooc" cards={NO_CARDS} cardsReady={false} cardsErrored />
    );
    expect(screen.getByText("Action unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
  });

  it("keeps a token inside a paragraph as balanced paragraphs around the card", () => {
    const cardMap = new Map([["a1", card("a1", "First action")]]);
    const { container } = render(
      <PostBody html="<p>before [ixaction=a1] after</p>" style="ooc" cards={cardMap} />
    );
    expect(
      Array.from(container.querySelectorAll("p"))
        .filter((p) => !p.closest("[data-slot=card]"))
        .map((p) => p.textContent)
    ).toEqual(["before ", " after"]);
    expect(screen.getByText("First action")).toBeInTheDocument();
  });

  it.each([
    ["title", '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>'],
    ["href", '<p><a href="https://e.com/?q=[ixaction=abc] <img src=x onerror=alert(1)>">l</a></p>'],
  ])("renders a token inside a %s attribute as inert text, with no live element", (_, html) => {
    const { container } = render(<PostBody html={html} style="ooc" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    const handlers = Array.from(container.querySelectorAll("*")).flatMap((el) =>
      el.getAttributeNames().filter((name) => name.startsWith("on"))
    );
    expect(handlers).toEqual([]);
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
  });

  it("still renders a card for a token in a list item", () => {
    const cardMap = new Map([["a1", card("a1", "First action")]]);
    const { container } = render(
      <PostBody html="<ul><li>one [ixaction=a1] two</li></ul>" style="ooc" cards={cardMap} />
    );
    expect(screen.getByText("First action")).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
      "one ",
      " two",
    ]);
  });

  it("renders the HTML once when there are no tokens", () => {
    const { container } = render(<PostBody html="<p>plain post</p>" style="ooc" />);
    expect(screen.getAllByText("plain post")).toHaveLength(1);
    expect(screen.queryByText("Unverified action")).not.toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

describe("PostBody styles", () => {
  it("renders a quote block and links its author line to the quoted post", () => {
    const html =
      '<blockquote class="forum-quote" data-post="p9"><div class="forum-quote-author">Ann wrote:</div><div class="forum-quote-body">hello</div></blockquote><p>reply</p>';
    const { container } = render(<PostBody html={html} style="ic" />);
    const quote = container.querySelector("blockquote.forum-quote");
    expect(quote).toHaveTextContent("hello");
    expect(screen.getByRole("link", { name: "Ann wrote:" })).toHaveAttribute(
      "href",
      "/p/thinkpages/post/p9"
    );
  });

  it("leaves a quote with a forged post id unlinked", () => {
    const html =
      '<blockquote class="forum-quote" data-post="a&quot; onmouseover=&quot;x"><div class="forum-quote-author">Eve wrote:</div><div class="forum-quote-body">hi</div></blockquote>';
    render(<PostBody html={html} style="ooc" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Eve wrote:")).toBeInTheDocument();
  });
});
