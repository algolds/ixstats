import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } },
    sports: {
      getLeague: { useQuery: () => ({ data: undefined, isLoading: false }) },
      getTeam: { useQuery: () => ({ data: undefined, isLoading: false }) },
    },
    countries: { getWikiRichIntro: { useQuery: () => ({ data: undefined, isLoading: false }) } },
    users: { resolveWikiAuthor: { useQuery: () => ({ data: undefined, isLoading: false }) } },
  },
}));

import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";

describe("WikiHtmlContent with old profile links", () => {
  it("opens the current pages", async () => {
    render(
      <WikiHtmlContent
        html={
          '<p><a href="/id/@bob/work">Bob work</a> <a href="/@kim/work">Kim work</a> ' +
          '<a href="https://ixwiki.com/id/@ann">Ann</a></p>'
        }
      />
    );

    await waitFor(() =>
      expect(screen.getByText("Bob work").getAttribute("href")).toBe("/@bob?tab=work")
    );
    expect(screen.getByText("Kim work").getAttribute("href")).toBe("/@kim?tab=work");
    expect(screen.getByText("Ann").getAttribute("href")).toBe("https://ixwiki.com/@ann");
  });

  it("opens an old ThinkPages profile link as a mention of the persona profile", async () => {
    render(<WikiHtmlContent html={'<p><a href="/thinkpages/profile/jane">jane</a></p>'} />);

    const mention = await screen.findByText("@jane");
    expect(mention.closest("a")?.getAttribute("href")).toBe("/dashboard/profile/jane");
  });
});
