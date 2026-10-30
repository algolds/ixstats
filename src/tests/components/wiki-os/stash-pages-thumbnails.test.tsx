/**
 * Thumbnails in the stash's pages list are IxWiki lead images, looked up by title: only an IxWiki item shows one, so a
 * sister-wiki page that shares an IxWiki title never shows IxWiki's picture.
 */
import { render, screen } from "@testing-library/react";
import { StashPagesList } from "~/components/wiki-os/stashes/StashPagesList";

const item = (id: string, source?: "ixwiki" | "iiwiki") => ({
  id,
  pageTitle: "Rome",
  pageSlug: "Rome",
  savedAt: "2026-10-01T00:00:00Z",
  source,
});

describe("StashPagesList thumbnails", () => {
  it("shows the IxWiki lead image on IxWiki items only", () => {
    render(
      <StashPagesList
        items={[item("ix", "ixwiki"), item("ii", "iiwiki"), item("legacy")]}
        onUnstash={() => {}}
        thumbnailsMap={{ Rome: "https://ixwiki.com/images/rome.png" }}
      />
    );

    expect(screen.getAllByRole("img", { name: "Rome" })).toHaveLength(2);
  });
});
