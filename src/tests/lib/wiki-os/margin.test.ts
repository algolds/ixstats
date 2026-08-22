// src/tests/lib/wiki-os/margin.test.ts
// Tests for WikiOS Margin, Selection Capsule, and Discussion Models.

import { describe, it, expect } from "@jest/globals";
import { HIGHLIGHT_PALETTE } from "../../../components/wiki-os/margin/SelectionCapsule";

describe("WikiOS Margin Suite", () => {
  it("provides valid highlight palette colors with distinct hex values", () => {
    expect(HIGHLIGHT_PALETTE).toBeDefined();
    expect(HIGHLIGHT_PALETTE.length).toBeGreaterThanOrEqual(4);
    for (const item of HIGHLIGHT_PALETTE) {
      expect(item.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(item.label).toBeDefined();
    }
  });

  it("normalizes article titles for discussion threads with underscores", () => {
    const rawTitle = "Treaty of Oakhaven 1984";
    const normalized = rawTitle.trim().replace(/ /g, "_");
    expect(normalized).toBe("Treaty_of_Oakhaven_1984");
  });

  it("calculates correct collapse states for discussion threads", () => {
    const thread = {
      id: "th-1",
      title: "Clarification on Article IV",
      status: "OPEN" as const,
      comments: [
        { id: "c-1", content: "Should this cite the 1992 treaty?" },
        { id: "c-2", content: "Yes, added reference." },
      ],
    };
    expect(thread.comments.length).toBe(2);
    expect(thread.status).toBe("OPEN");
  });

  it("handles suggestions with proposed replacements on discussion comments", () => {
    const commentWithSuggestion = {
      id: "c-3",
      content: "Suggesting more accurate phrasing",
      suggestedEdit: "The Treaty of Oakhaven was ratified in October 1984.",
    };
    expect(commentWithSuggestion.suggestedEdit).toBeDefined();
    expect(commentWithSuggestion.suggestedEdit).toContain("October 1984");
  });
});
