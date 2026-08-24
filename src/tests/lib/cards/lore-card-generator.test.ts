// src/lib/cards/__tests__/lore-card-generator.test.ts
// Unit tests verifying lore-card-generator domain exports and interfaces.

import { describe, it, expect } from "@jest/globals";
import { wikiLoreCardGenerator, WikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";

describe("Lore Card Generator Domain Colocation", () => {
  it("exports singleton and class definition from lib/cards/lore-card-generator", () => {
    expect(wikiLoreCardGenerator).toBeDefined();
    expect(wikiLoreCardGenerator).toBeInstanceOf(WikiLoreCardGenerator);
    expect(typeof wikiLoreCardGenerator.generateCard).toBe("function");
  });
});
