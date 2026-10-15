import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { WikiSectionCard } from "~/components/mycountry/dossier/dossier/WikiSectionCard";
import type { WikiSection } from "~/lib/builder";
import type { WikiSource } from "~/lib/wiki-os/config";

const section: WikiSection = {
  id: "history",
  title: "Early history",
  sourcePage: "Tagmatine Empire",
  content: "Some content",
  classification: "PUBLIC",
  importance: "medium",
  wordCount: 2,
  lastModified: "2026-01-01",
};

function renderCard(wikiSource: WikiSource) {
  render(
    <WikiSectionCard
      section={section}
      isOpen
      onToggle={jest.fn()}
      onShowFullContent={jest.fn()}
      handleWikiLinkClick={jest.fn()}
      flagColors={{ primary: "#000", secondary: "#111", accent: "#222" }}
      countryName="Tagmatia"
      wikiSource={wikiSource}
    />
  );
  return screen.getByRole("link", { name: /View WikiOS source/ });
}

describe("WikiSectionCard source link", () => {
  it("opens the main wiki's page in WikiOS", () => {
    const link = renderCard("ixwiki");
    expect(link.getAttribute("href")).toMatch(/\/wiki\/Tagmatine_Empire$/);
    expect(link).not.toHaveAttribute("target");
  });

  it.each(["iiwiki", "althistory"] as const)(
    "opens a %s page in WikiOS, in the same tab",
    (source) => {
      const link = renderCard(source);
      expect(link.getAttribute("href")).toMatch(
        new RegExp(`/wiki/Tagmatine_Empire\\?source=${source}$`)
      );
      expect(link).not.toHaveAttribute("target");
    }
  );
});
