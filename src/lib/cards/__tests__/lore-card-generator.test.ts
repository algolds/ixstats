// src/lib/cards/__tests__/lore-card-generator.test.ts
// Unit tests verifying lore-card-generator domain exports and interfaces.

import { describe, it, expect } from "@jest/globals";
import { wikiLoreCardGenerator, WikiLoreCardGenerator } from "../lore-card-generator";
import { wikiLoreCardGenerator as reExportedGenerator } from "../index";

describe("Lore Card Generator Domain Colocation", () => {
  it("exports singleton and class definition from lib/cards", () => {
    expect(wikiLoreCardGenerator).toBeDefined();
    expect(reExportedGenerator).toBeDefined();
    expect(wikiLoreCardGenerator).toBeInstanceOf(WikiLoreCardGenerator);
    expect(typeof wikiLoreCardGenerator.generateCard).toBe("function");
  });
});
