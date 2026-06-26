// src/lib/onoma/generators.test.ts
import { MarkovChain } from "./markov-chain";
import {
  generateBusinessCompanyName,
  generateAcademicInstitutionName,
  generateMercenaryBandName,
} from "./group-generator";
import { generateNobleSurname } from "./name-generator";

describe("Onoma Lab Category Preset Generators", () => {
  let chain: MarkovChain;

  beforeEach(() => {
    chain = new MarkovChain(2);
    chain.addWords(["Constantia", "Alexandria", "Uppsala", "Corduba", "Heidelberg"]);
  });

  test("generateBusinessCompanyName should generate business names using chain or fallback", () => {
    const nameWithChain = generateBusinessCompanyName(chain);
    expect(nameWithChain).toBeDefined();
    expect(nameWithChain.length).toBeGreaterThan(0);

    const nameWithoutChain = generateBusinessCompanyName();
    expect(nameWithoutChain).toBeDefined();
    expect(nameWithoutChain.length).toBeGreaterThan(0);
  });

  test("generateAcademicInstitutionName should generate academy/university names", () => {
    const nameWithChain = generateAcademicInstitutionName(chain);
    expect(nameWithChain).toBeDefined();
    expect(nameWithChain).toMatch(
      /(University|Academy|College|Institute|Lyceum|Conservatory|School)/
    );

    const nameWithoutChain = generateAcademicInstitutionName();
    expect(nameWithoutChain).toBeDefined();
  });

  test("generateMercenaryBandName should generate mercenary companies", () => {
    const nameWithChain = generateMercenaryBandName(chain);
    expect(nameWithChain).toBeDefined();
    expect(nameWithChain.length).toBeGreaterThan(0);

    const nameWithoutChain = generateMercenaryBandName();
    expect(nameWithoutChain).toBeDefined();
  });

  test("generateNobleSurname should generate culture-specific surnames", () => {
    // Latin
    const latinName = generateNobleSurname("latin", chain);
    expect(latinName).toMatch(/^(de|di) [A-Z]/);

    // Germanic
    const germanicName = generateNobleSurname("germanic", chain);
    expect(germanicName).toMatch(/^(von|zu) [A-Z]/);

    // Celtic
    const celticName = generateNobleSurname("celtic", chain);
    expect(celticName).toMatch(/^(O'|Mac)[A-Z]/);

    // Slavic
    const slavicName = generateNobleSurname("slavic", chain);
    expect(slavicName).toMatch(/(ovich|ic)$/);

    // Arabic
    const arabicName = generateNobleSurname("arabic", chain);
    expect(arabicName).toMatch(/^(Al-|ibn )[A-Z]/);
  });
});
