import React from "react";
import { render, screen } from "@testing-library/react";

// The real WikiHtmlContent and the real PostBody; only the data layer and next/link are replaced. next/link is
// replaced by what Next does with a plain path: it puts the base path in front, once, with no check for a prefix.
jest.mock("~/trpc/react", () => ({
  api: { wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } } },
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={/^https?:/.test(href) ? href : `/projects/ixstates${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { PostBody } from "~/components/thinkpages-forum/thread/PostBody";

const BASE = "/projects/ixstates";
let savedBase: string | undefined;

beforeAll(() => {
  savedBase = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = BASE;
  // withBasePath only applies the base when the page is served under it.
  window.history.pushState({}, "", `${BASE}/thinkpages/t/t1`);
});

afterAll(() => {
  if (savedBase === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = savedBase;
  window.history.pushState({}, "", "/");
});

describe("PostBody with the real renderer", () => {
  it("keeps a quote's source link, its class and an image's width and height", () => {
    const html =
      '<blockquote class="forum-quote" data-post="p9"><div class="forum-quote-author">Ann wrote:</div><div class="forum-quote-body">hi</div></blockquote><p><img src="https://x/y.png" alt="" width="320" height="200"></p>';
    const { container } = render(<PostBody html={html} style="ic" />);
    const link = screen.getByRole("link", { name: "Ann wrote:" });
    expect(link).toHaveClass("forum-quote-source");
    expect(link.closest("blockquote")).toHaveClass("forum-quote");
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("320");
    expect(img.getAttribute("height")).toBe("200");
  });

  it.each([
    ["a quote's source link", '<blockquote class="forum-quote" data-post="p9"><div class="forum-quote-author">Ann wrote:</div></blockquote>', "Ann wrote:", "thinkpages/post/p9"],
    ["an internal link in the text", '<p><a href="/thinkpages/post/123">see</a></p>', "see", "thinkpages/post/123"],
  ])("puts the base path on %s exactly once", (_, html, name, path) => {
    render(<PostBody html={html} style="ooc" />);
    expect(screen.getByRole("link", { name })).toHaveAttribute("href", `${BASE}/${path}`);
  });
});
