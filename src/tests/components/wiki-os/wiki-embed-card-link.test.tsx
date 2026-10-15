import { render, screen, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: { wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } } },
}));

import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";

function embed(title: string, source: string): string {
  return `<div data-wikiembed="true" data-title="${title}" data-summary="A summary" data-source="${source}"></div>`;
}

describe("a wiki embed card", () => {
  it("opens a main wiki article in WikiOS, in the same tab", async () => {
    render(<WikiHtmlContent html={embed("Urcea Nation", "ixwiki")} />);
    const link = await waitFor(() => screen.getByRole("link", { name: /Urcea Nation/ }));
    expect(link.getAttribute("href")).toMatch(/\/wiki\/Urcea_Nation$/);
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByText("Wiki article")).toBeInTheDocument();
  });

  it("opens a sister wiki article in WikiOS too, credited to its source", async () => {
    render(<WikiHtmlContent html={embed("Tagmatine Empire", "iiwiki")} />);
    const link = await waitFor(() => screen.getByRole("link", { name: /Tagmatine Empire/ }));
    expect(link.getAttribute("href")).toMatch(/\/wiki\/Tagmatine_Empire\?source=iiwiki$/);
    expect(link.getAttribute("href")).not.toContain("iiwiki.com");
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByText("From IIWiki")).toBeInTheDocument();
  });
});
