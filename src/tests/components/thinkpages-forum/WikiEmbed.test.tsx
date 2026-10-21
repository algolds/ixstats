import { useRef } from "react";
import { render, screen } from "@testing-library/react";

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
  it("hydrates at most ten embeds in a post and leaves the plain links for the rest", async () => {
    const html = Array.from({ length: 13 }, (_, i) => embed("summary", `Page ${i}`)).join("");
    render(<Harness html={html} />);
    expect(await screen.findAllByTestId("summary")).toHaveLength(10);
    expect(screen.getAllByRole("link")).toHaveLength(13);
  });
});
