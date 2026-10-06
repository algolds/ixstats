/**
 * core-domain.test.ts — Unit tests for WikiOS Core Domain Services
 */

import { describe, expect, it } from "@jest/globals";
import { toArticleSlug } from "~/lib/wiki-os/core/domain-types";

describe("WikiOS Domain Types & Slugifier", () => {
  it("normalizes article titles into slugs correctly", () => {
    expect(toArticleSlug("Treaty of Oakhaven")).toBe("treaty_of_oakhaven");
    expect(toArticleSlug("Vesper__Republic")).toBe("vesper_republic");
    expect(toArticleSlug("  Capital City  ")).toBe("capital_city");
  });
});
