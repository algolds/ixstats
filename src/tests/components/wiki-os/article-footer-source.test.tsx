import { render, screen } from "@testing-library/react";
import { ArticleFooter } from "~/components/wiki-os/reader/ArticleFooter";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

describe("ArticleFooter: View on Original Wiki", () => {
  it("links another wiki's page to that wiki", () => {
    render(<ArticleFooter title="Portal:Eurth" lastModified={null} wikiSource="iiwiki" />);
    expect(screen.getByRole("link", { name: "View on Original Wiki" })).toHaveAttribute(
      "href",
      "https://iiwiki.com/wiki/Portal%3AEurth"
    );
  });

  it("links an IxWiki page to IxWiki, as before", () => {
    render(<ArticleFooter title="United Kingdom of Aurelia" lastModified={null} />);
    expect(screen.getByRole("link", { name: "View on Original Wiki" })).toHaveAttribute(
      "href",
      `${mediaWikiOrigin()}/wiki/United_Kingdom_of_Aurelia`
    );
  });
});
