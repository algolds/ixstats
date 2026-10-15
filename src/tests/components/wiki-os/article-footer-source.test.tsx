import { render, screen } from "@testing-library/react";
import { ArticleFooter } from "~/components/wiki-os/reader/ArticleFooter";

describe("ArticleFooter: View on original wiki", () => {
  it("links another wiki's page to that wiki", () => {
    render(<ArticleFooter title="Portal:Eurth" lastModified={null} wikiSource="iiwiki" />);
    expect(screen.getByRole("link", { name: "View on original wiki" })).toHaveAttribute(
      "href",
      "https://iiwiki.com/wiki/Portal%3AEurth"
    );
  });

  it("offers no original-wiki link for a page of the main wiki, which is read here already", () => {
    render(<ArticleFooter title="United Kingdom of Aurelia" lastModified={null} />);
    expect(screen.queryByRole("link", { name: "View on original wiki" })).toBeNull();
    render(
      <ArticleFooter title="United Kingdom of Aurelia" lastModified={null} wikiSource="ixwiki" />
    );
    expect(screen.queryByRole("link", { name: "View on original wiki" })).toBeNull();
  });
});
