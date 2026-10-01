import { describe, it, expect } from "@jest/globals";
import { cn } from "~/lib/utils/cn";

describe("cn with Facet 3 token utilities", () => {
  it("keeps a text style and a label colour together", () => {
    expect(cn("text-body text-label")).toBe("text-body text-label");
    expect(cn("text-footnote text-label-secondary")).toBe("text-footnote text-label-secondary");
  });

  it("lets a later text style, radius, shadow, z tier or material win", () => {
    expect(cn("text-body", "text-headline")).toBe("text-headline");
    expect(cn("text-sm", "text-title-2")).toBe("text-title-2");
    expect(cn("rounded-xl", "rounded-card")).toBe("rounded-card");
    expect(cn("shadow-lg", "shadow-floating")).toBe("shadow-floating");
    expect(cn("z-50", "z-popover")).toBe("z-popover");
    expect(cn("material-thin", "material-thick")).toBe("material-thick");
  });

  it("still resolves plain colour conflicts", () => {
    expect(cn("text-label", "text-destructive")).toBe("text-destructive");
  });
});
