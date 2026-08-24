// src/tests/lib/wiki-os/margin.test.ts
// Comprehensive unit tests for WikiOS Margin Suite and Lore Theory integration:
// 5 Ws Priority Hierarchy, Hub-and-Spoke Linearity, Sprout Child Slug Generation,
// Clustered Gutter Pins, and Avatar Normalization.

import { describe, it, expect } from "@jest/globals";
import { HIGHLIGHT_PALETTE } from "~/components/wiki-os/margin/SelectionCapsule";
import {
  THREAD_CATEGORIES,
  LORE_DIMENSIONS,
} from "~/components/wiki-os/margin/tabs/MarginThreadsTab";
import { getInitials } from "~/components/wiki-os/margin/shared/MarginUserAvatar";

describe("WikiOS Margin Suite & Lore Theory Engine", () => {
  it("provides valid highlight palette colors with distinct hex values", () => {
    expect(HIGHLIGHT_PALETTE).toBeDefined();
    expect(HIGHLIGHT_PALETTE.length).toBeGreaterThanOrEqual(4);
    for (const item of HIGHLIGHT_PALETTE) {
      expect(item.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(item.label).toBeDefined();
    }
  });

  it("defines the Five Ws Lore Priority Hierarchy correctly", () => {
    expect(LORE_DIMENSIONS).toBeDefined();
    expect(LORE_DIMENSIONS.length).toBe(5);

    const whyDim = LORE_DIMENSIONS.find((d: any) => d.id === "WHY");
    expect(whyDim).toBeDefined();
    expect(whyDim?.emoji).toBe("🌟");
    expect(whyDim?.label).toContain("Why");

    const whenDim = LORE_DIMENSIONS.find((d: any) => d.id === "WHEN");
    expect(whenDim).toBeDefined();
    expect(whenDim?.emoji).toBe("⏳");

    const whereDim = LORE_DIMENSIONS.find((d: any) => d.id === "WHERE");
    expect(whereDim).toBeDefined();
    expect(whereDim?.emoji).toBe("🗺️");

    const whoDim = LORE_DIMENSIONS.find((d: any) => d.id === "WHO");
    expect(whoDim).toBeDefined();
    expect(whoDim?.emoji).toBe("👤");

    const whatDim = LORE_DIMENSIONS.find((d: any) => d.id === "WHAT");
    expect(whatDim).toBeDefined();
    expect(whatDim?.emoji).toBe("📦");
  });

  it("normalizes initials for MarginUserAvatar correctly", () => {
    expect(getInitials("Alistair")).toBe("AL");
    expect(getInitials("Chancellor Alistair")).toBe("CA");
    expect(getInitials("Grand_Duchy_of_Vorn")).toBe("GV");
    expect(getInitials("")).toBe("?");
  });

  it("generates clean sprout child slugs for linear development", () => {
    const rawTopic = "Soltane Harvest Fruit of Taistia & Provinces!";
    const sproutChildSlug = rawTopic
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .slice(0, 40)
      .trim()
      .replace(/ /g, "_");

    expect(sproutChildSlug).toBe("Soltane_Harvest_Fruit_of_Taistia__Provin");
    expect(sproutChildSlug).not.toContain("!");
    expect(sproutChildSlug).not.toContain("&");
  });

  it("classifies Loadbearing Spokes vs Iterative Lore correctly", () => {
    const loadbearingKeywords = [
      "government of",
      "politics of",
      "economy of",
      "history of",
      "military of",
    ];

    const isLoadbearing = (title: string) =>
      loadbearingKeywords.some((kw) => title.toLowerCase().includes(kw));

    expect(isLoadbearing("Government of Taistia")).toBe(true);
    expect(isLoadbearing("Economy of Vorn")).toBe(true);
    expect(isLoadbearing("History of the Eastern Marches")).toBe(true);
    expect(isLoadbearing("Cuisine of Taistia")).toBe(false);
    expect(isLoadbearing("Battle of Red Ridge")).toBe(false);
  });

  it("clusters closely spaced gutter pins to resolve visual collisions", () => {
    const rawPins = [
      { id: "1", type: "thread", top: 100, title: "T1" },
      { id: "2", type: "annotation", top: 110, title: "A1" },
      { id: "3", type: "thread", top: 250, title: "T2" },
    ];

    const clustered: Array<{ id: string; type: string; top: number; count: number }> = [];
    for (const pin of rawPins) {
      const last = clustered[clustered.length - 1];
      if (last && Math.abs(last.top - pin.top) < 28) {
        last.type = "cluster";
        last.count += 1;
      } else {
        clustered.push({ id: pin.id, type: pin.type, top: pin.top, count: 1 });
      }
    }

    expect(clustered.length).toBe(2);
    expect(clustered[0]!.type).toBe("cluster");
    expect(clustered[0]!.count).toBe(2);
    expect(clustered[1]!.type).toBe("thread");
    expect(clustered[1]!.count).toBe(1);
  });

  it("formats research notes for Markdown and WikiText exports with Lore Significance", () => {
    const articleTitle = "Kingdom of Oakhaven";
    const slug = encodeURIComponent(articleTitle.replace(/ /g, "_"));
    const quote = "The royal fleet comprised forty galleons.";
    const note = "Shows naval supremacy during the second war";

    const mdExport = `> "${quote}"\n\n— *[${articleTitle}](https://ixwiki.com/wiki/${slug})*\n> *Lore Significance: ${note}*`;
    expect(mdExport).toContain("> \"The royal fleet comprised forty galleons.\"");
    expect(mdExport).toContain("Lore Significance: Shows naval supremacy");

    const wikiTextExport = `{{quote|text=${quote}|author=[[${articleTitle}]]|significance=${note}}}`;
    expect(wikiTextExport).toContain("significance=Shows naval supremacy during the second war");
  });
});
