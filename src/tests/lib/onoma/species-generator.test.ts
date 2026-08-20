// src/lib/onoma/species-generator.test.ts
import {
  generateGoblinName,
  generateOrcName,
  generateOgreName,
  generatePrimitiveName,
  generateDwarfName,
  generateHalflingName,
  generateGnomeName,
  generateElfName,
  generateFaeryName,
  generateDarkElfName,
  generateHalfDemonName,
  generateDragonName,
  generateDemonName,
  generateAngelName,
} from "~/lib/onoma/species-generator";

describe("Species Name Generators", () => {
  test("generates goblin, orc, ogre names", () => {
    expect(generateGoblinName().length).toBeGreaterThan(0);
    expect(generateOrcName().length).toBeGreaterThan(0);
    expect(generateOgreName().length).toBeGreaterThan(0);
  });

  test("generates primitive names across genders", () => {
    expect(generatePrimitiveName("male").length).toBeGreaterThan(0);
    expect(generatePrimitiveName("female").length).toBeGreaterThan(0);
    expect(generatePrimitiveName("neutral").length).toBeGreaterThan(0);
  });

  test("generates dwarf, halfling, gnome names", () => {
    expect(generateDwarfName("male").length).toBeGreaterThan(0);
    expect(generateDwarfName("female").length).toBeGreaterThan(0);
    expect(generateHalflingName("male").length).toBeGreaterThan(0);
    expect(generateHalflingName("female").length).toBeGreaterThan(0);
    expect(generateGnomeName("male").length).toBeGreaterThan(0);
    expect(generateGnomeName("female").length).toBeGreaterThan(0);
  });

  test("generates elf, faery, dark elf names", () => {
    expect(generateElfName("male", false).length).toBeGreaterThan(0);
    expect(generateElfName("female", true).length).toBeGreaterThan(0);
    expect(generateFaeryName("male", false).length).toBeGreaterThan(0);
    expect(generateFaeryName("female", true).length).toBeGreaterThan(0);
    expect(generateDarkElfName("male", false).length).toBeGreaterThan(0);
    expect(generateDarkElfName("female", true).length).toBeGreaterThan(0);
  });

  test("generates half-demon, dragon, demon, and angel names", () => {
    expect(generateHalfDemonName("male").length).toBeGreaterThan(0);
    expect(generateDragonName("female").length).toBeGreaterThan(0);
    expect(generateDemonName().length).toBeGreaterThan(0);
    expect(generateAngelName("male").length).toBeGreaterThan(0);
    expect(generateAngelName("female").length).toBeGreaterThan(0);
  });
});
