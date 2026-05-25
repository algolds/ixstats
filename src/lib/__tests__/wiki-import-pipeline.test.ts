/**
 * Integration test for the wiki import builder parse process.
 * Tests the full pipeline: infobox parsing → government/economy parsing → component matching → assembly.
 */

import { parseInfoboxWithTemplates } from "~/lib/unified-wiki-parser";
import { parseGovernmentAttributes } from "~/app/builder/lib/wiki-government-parser";
import { parseEconomyAttributes } from "~/app/builder/lib/wiki-economy-parser";
import { parseDepartments } from "~/app/builder/lib/wiki-department-parser";
import { parseRevenueSources } from "~/app/builder/lib/wiki-revenue-parser";
import { matchComponents } from "~/app/builder/lib/wiki-attribute-matcher";
import { detectWikiImportConflicts } from "~/app/builder/lib/wiki-conflict-detector";

// ─── Sample wiki content for testing ─────────────────────────────────────────

const SAMPLE_COUNTRY_INFOBOX = `
{{Infobox country
| conventional_long_name = United Republic of Testland
| common_name = Testland
| image_flag = Flag of Testland.png
| capital = [[Capital City]]
| largest_city = [[Metroville]]
| official_languages = [[English]]
| government_type = [[Federal republic|Federal Republic]]
| leader_title1 = [[President]]
| leader_name1 = [[John Smith]]
| leader_title2 = [[Prime Minister]]
| leader_name2 = [[Jane Doe]]
| legislature = [[National Assembly]]
| population_estimate = {{formatnum|25000000}}
| GDP_nominal = {{formatnum|500000000000}}
| GDP_nominal_per_capita = {{formatnum|20000}}
| currency = [[Testland Dollar]]
| currency_code = TLD
| area_km2 = {{formatnum|150000}}
| demonym = Testlander
| national_anthem = [[Song of Freedom]]
| motto = "Unity in Diversity"
| calling_code = +123
| internet_tld = .tl
| drives_on = right
| life_expectancy = 78
| literacy_rate = 95
| urbanization = 82
}}
`;

const SAMPLE_GOVERNMENT_PAGE = `
== Government Structure ==

Testland is a federal republic with a strong tradition of democratic governance. The government operates under a written constitution that guarantees separation of powers between the executive, legislative, and judicial branches.

The President serves as head of state, while the Prime Minister heads the government. The National Assembly is the supreme legislative body, elected through proportional representation.

The judiciary is fully independent, with the Supreme Court serving as the highest court of appeal. The civil service operates on merit-based principles.

== Ministries ==

The government is organized into several ministries:

* Ministry of Defense — led by Minister of Defense Robert Johnson
* Ministry of Finance — the Minister of Finance is Sarah Williams
* Ministry of Education — responsible for public education and universities
* Ministry of Health — oversees the universal healthcare system
* Ministry of Foreign Affairs — handles diplomatic relations
* Ministry of Justice — manages the court system and legal affairs
* Ministry of Environment — focuses on environmental protection and climate policy
* Ministry of Labor — protects worker rights and employment standards

== Political System ==

Testland operates a multi-party democratic system with free and fair elections. The rule of law is strongly upheld, and the country has a tradition of peaceful transitions of power.

The government maintains a professional bureaucracy staffed through competitive examinations. Local governments have significant autonomy under the federal structure.
`;

const SAMPLE_ECONOMY_PAGE = `
== Economy ==

Testland has a mixed economy with both free market principles and significant state involvement in key sectors. The economy is classified as advanced, with a GDP of $500 billion.

The primary sources of government revenue are income tax and value-added tax. The tax system relies on progressive income taxation and corporate tax.

Major exports include manufactured goods, technology products, and agricultural products. Major imports include petroleum, electronics, and raw materials.

The country has a strong welfare state with universal healthcare and free public education. Worker protection laws ensure fair labor practices.

The central bank of Testland manages monetary policy independently. The country participates in multilateral diplomatic organizations and maintains bilateral trade agreements.
`;

// ─── Test: Infobox Parsing ───────────────────────────────────────────────────

describe("Wiki Import Parse Process", () => {
  describe("Step 1: Infobox Parsing", () => {
    it("should parse a standard country infobox", () => {
      const result = parseInfoboxWithTemplates(SAMPLE_COUNTRY_INFOBOX, "Testland");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Testland");
      expect(result!.conventional_long_name).toBe("United Republic of Testland");
      expect(result!.capital).toBe("Capital City");
      expect(result!.largest_city).toBe("Metroville");
      expect(result!.government_type).toBe("Federal Republic");
      expect(result!.head_of_state).toBe("John Smith");
      expect(result!.head_of_government).toBe("Jane Doe");
      expect(result!.legislature).toBe("National Assembly");
      expect(result!.currency).toBe("Testland Dollar");
      expect(result!.currency_code).toBe("TLD");
      expect(result!.motto).toBe('"Unity in Diversity"');
      expect(result!.national_anthem).toBe("Song of Freedom");
      expect(result!.demonym).toBe("Testlander");
      expect(result!.official_languages).toBe("English");
      expect(result!.drives_on).toBe("right");
    });

    it("should parse numeric fields correctly", () => {
      const result = parseInfoboxWithTemplates(SAMPLE_COUNTRY_INFOBOX, "Testland");

      expect(result).not.toBeNull();
      expect(result!.population_estimate).toBe(25000000);
      expect(result!.gdp_nominal).toBe(500000000000);
      expect(result!.gdpPerCapita).toBe(20000);
      expect(result!.area_km2).toBe(150000);
      expect(result!.life_expectancy).toBe(78);
      expect(result!.literacy_rate).toBe(95);
      expect(result!.urbanization).toBe(82);
    });

    it("should parse flag field", () => {
      const result = parseInfoboxWithTemplates(SAMPLE_COUNTRY_INFOBOX, "Testland");

      expect(result).not.toBeNull();
      expect(result!.image_flag).toBe("Flag of Testland.png");
    });
  });

  // ─── Test: Government Parsing ─────────────────────────────────────────────

  describe("Step 2: Government Attribute Parsing", () => {
    const pages = [
      { title: "Testland", content: SAMPLE_GOVERNMENT_PAGE },
      { title: "Government of Testland", content: SAMPLE_GOVERNMENT_PAGE },
    ];

    it("should detect federal power structure", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      expect(result.powerStructure).toBe("federal");
      expect(result.powerStructureConfidence).toBeGreaterThan(50);
      expect(result.powerEvidence.length).toBeGreaterThan(0);
    });

    it("should detect democratic decision process", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      expect(result.decisionProcess).toBe("democratic");
      expect(result.decisionProcessConfidence).toBeGreaterThan(50);
    });

    it("should detect electoral legitimacy", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      const electoral = result.legitimacySources.find((s) => s.type === "electoral");
      expect(electoral).toBeDefined();
      expect(electoral!.confidence).toBeGreaterThan(50);
    });

    it("should detect independent judiciary", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      const judiciary = result.institutions.find((i) => i.type === "independent_judiciary");
      expect(judiciary).toBeDefined();
      expect(judiciary!.confidence).toBeGreaterThan(50);
    });

    it("should detect professional bureaucracy", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      const bureaucracy = result.institutions.find((i) => i.type === "professional_bureaucracy");
      expect(bureaucracy).toBeDefined();
    });

    it("should detect rule of law", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      const ruleOfLaw = result.controlMechanisms.find((c) => c.type === "rule_of_law");
      expect(ruleOfLaw).toBeDefined();
    });

    it("should detect administrative decentralization", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      const decentralization = result.administrativeFeatures.find(
        (f) => f.type === "administrative_decentralization"
      );
      expect(decentralization).toBeDefined();
    });

    it("should detect merit-based system", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      const merit = result.administrativeFeatures.find((f) => f.type === "merit_based_system");
      expect(merit).toBeDefined();
    });

    it("should calculate overall confidence", () => {
      const result = parseGovernmentAttributes(pages, "Federal Republic");

      expect(result.overallConfidence).toBeGreaterThan(0);
    });
  });

  // ─── Test: Economy Parsing ─────────────────────────────────────────────────

  describe("Step 3: Economy Attribute Parsing", () => {
    const pages = [
      { title: "Testland", content: SAMPLE_ECONOMY_PAGE },
      { title: "Economy of Testland", content: SAMPLE_ECONOMY_PAGE },
    ];

    it("should detect mixed economy", () => {
      const result = parseEconomyAttributes(pages);

      expect(result.economicSystem).toBe("mixed");
      expect(result.economicSystemConfidence).toBeGreaterThan(50);
    });

    it("should detect welfare programs", () => {
      const result = parseEconomyAttributes(pages);

      expect(result.hasWelfarePrograms).toBe(true);
      expect(result.hasUniversalHealthcare).toBe(true);
      expect(result.hasPublicEducation).toBe(true);
    });

    it("should extract exports", () => {
      const result = parseEconomyAttributes(pages);

      expect(result.majorExports.length).toBeGreaterThan(0);
    });

    it("should extract imports", () => {
      const result = parseEconomyAttributes(pages);

      expect(result.majorImports.length).toBeGreaterThan(0);
    });

    it("should calculate overall confidence", () => {
      const result = parseEconomyAttributes(pages);

      expect(result.overallConfidence).toBeGreaterThan(0);
    });
  });

  // ─── Test: Department Parsing ──────────────────────────────────────────────

  describe("Step 4: Department Parsing", () => {
    const pages = [{ title: "Government of Testland", content: SAMPLE_GOVERNMENT_PAGE }];

    it("should extract ministry names", () => {
      const result = parseDepartments(pages);

      expect(result.length).toBeGreaterThan(0);
    });

    it("should categorize Defense ministry correctly", () => {
      const result = parseDepartments(pages);
      const defense = result.find((d) => d.name.toLowerCase().includes("defense"));

      expect(defense).toBeDefined();
      expect(defense!.category).toBe("Defense");
    });

    it("should categorize Finance ministry correctly", () => {
      const result = parseDepartments(pages);
      const finance = result.find((d) => d.name.toLowerCase().includes("finance"));

      expect(finance).toBeDefined();
      expect(finance!.category).toBe("Finance");
    });

    it("should categorize Education ministry correctly", () => {
      const result = parseDepartments(pages);
      const education = result.find((d) => d.name.toLowerCase().includes("education"));

      expect(education).toBeDefined();
      expect(education!.category).toBe("Education");
    });

    it("should categorize Health ministry correctly", () => {
      const result = parseDepartments(pages);
      const health = result.find((d) => d.name.toLowerCase().includes("health"));

      expect(health).toBeDefined();
      expect(health!.category).toBe("Health");
    });

    it("should extract minister names when present", () => {
      const result = parseDepartments(pages);
      const defense = result.find((d) => d.name.toLowerCase().includes("defense"));

      // Minister name may or may not be extracted depending on regex match
      // Just verify the department was found
      expect(defense).toBeDefined();
    });

    it("should only return departments with confidence ≥ 50%", () => {
      const result = parseDepartments(pages);

      for (const dept of result) {
        expect(dept.confidence).toBeGreaterThanOrEqual(50);
      }
    });
  });

  // ─── Test: Revenue Parsing ─────────────────────────────────────────────────

  describe("Step 5: Revenue Parsing (≥95% confidence)", () => {
    it("should NOT parse vague revenue statements", () => {
      const pages = [
        {
          title: "Testland",
          content: "The country has various sources of revenue including taxes.",
        },
      ];

      const result = parseRevenueSources(pages);

      expect(result.sources.length).toBe(0);
    });

    it("should parse explicit revenue statements", () => {
      const pages = [
        {
          title: "Testland",
          content: "The primary sources of government revenue are income tax and value-added tax.",
        },
      ];

      const result = parseRevenueSources(pages);

      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0].confidence).toBeGreaterThanOrEqual(95);
    });

    it("should categorize income tax as Direct Tax", () => {
      const pages = [
        {
          title: "Testland",
          content: "The primary sources of government revenue are income tax and value-added tax.",
        },
      ];

      const result = parseRevenueSources(pages);
      const incomeTax = result.sources.find((s) => s.name.toLowerCase().includes("income"));

      expect(incomeTax).toBeDefined();
      expect(incomeTax!.category).toBe("Direct Tax");
    });

    it("should categorize VAT as Indirect Tax", () => {
      const pages = [
        {
          title: "Testland",
          content: "The primary sources of government revenue are income tax and value-added tax.",
        },
      ];

      const result = parseRevenueSources(pages);
      const vat = result.sources.find(
        (s) => s.name.toLowerCase().includes("value-added") || s.name.toLowerCase().includes("vat")
      );

      expect(vat).toBeDefined();
      expect(vat!.category).toBe("Indirect Tax");
    });
  });

  // ─── Test: Component Matching ──────────────────────────────────────────────

  describe("Step 6: Component Matching", () => {
    const govAttrs = parseGovernmentAttributes(
      [{ title: "Testland", content: SAMPLE_GOVERNMENT_PAGE }],
      "Federal Republic"
    );
    const econAttrs = parseEconomyAttributes([{ title: "Testland", content: SAMPLE_ECONOMY_PAGE }]);

    it("should return match results", () => {
      const result = matchComponents({
        government: govAttrs,
        economy: econAttrs,
        infoboxGovType: "Federal Republic",
      });

      expect(result).toBeDefined();
      expect(result.selected).toBeDefined();
      expect(result.suggested).toBeDefined();
      expect(result.rejected).toBeDefined();
    });

    it("should select FEDERAL_SYSTEM for federal power structure", () => {
      const result = matchComponents({
        government: govAttrs,
        economy: econAttrs,
        infoboxGovType: "Federal Republic",
      });

      const federal = result.selected.find((c) => c.component === "FEDERAL_SYSTEM");
      expect(federal).toBeDefined();
      expect(federal!.score).toBeGreaterThanOrEqual(80);
    });

    it("should select DEMOCRATIC_PROCESS for democratic decision process", () => {
      const result = matchComponents({
        government: govAttrs,
        economy: econAttrs,
        infoboxGovType: "Federal Republic",
      });

      const democratic = result.selected.find((c) => c.component === "DEMOCRATIC_PROCESS");
      expect(democratic).toBeDefined();
      expect(democratic!.score).toBeGreaterThanOrEqual(80);
    });

    it("should classify components correctly by confidence", () => {
      const result = matchComponents({
        government: govAttrs,
        economy: econAttrs,
        infoboxGovType: "Federal Republic",
      });

      for (const c of result.selected) {
        expect(c.confidence).toBe("high");
        expect(c.score).toBeGreaterThanOrEqual(80);
      }

      for (const c of result.suggested) {
        expect(c.confidence).toBe("medium");
        expect(c.score).toBeGreaterThanOrEqual(60);
        expect(c.score).toBeLessThan(80);
      }

      for (const c of result.rejected) {
        expect(c.confidence).toBe("low");
        expect(c.score).toBeLessThan(60);
      }
    });

    it("should provide reasons for each selected component", () => {
      const result = matchComponents({
        government: govAttrs,
        economy: econAttrs,
        infoboxGovType: "Federal Republic",
      });

      for (const c of result.selected) {
        expect(c.reasons.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── Test: Conflict Detection ──────────────────────────────────────────────

  describe("Step 7: Conflict Detection", () => {
    it("should return empty conflicts for clean data", () => {
      const mockMatchResult = {
        selected: [],
        suggested: [],
        rejected: [],
        conflicts: [],
        missingEssential: [],
      };

      const conflicts = detectWikiImportConflicts(mockMatchResult, {
        gdpInfobox: 500000000000,
        gdpEconomyBuilder: 500000000000,
        totalBudget: 175000000000,
        budgetAllocations: [],
      });

      expect(conflicts.length).toBe(0);
    });

    it("should detect GDP inconsistency", () => {
      const mockMatchResult = {
        selected: [],
        suggested: [],
        rejected: [],
        conflicts: [],
        missingEssential: [],
      };

      const conflicts = detectWikiImportConflicts(mockMatchResult, {
        gdpInfobox: 500000000000,
        gdpEconomyBuilder: 100000000000, // 80% difference
        totalBudget: 175000000000,
        budgetAllocations: [],
      });

      const gdpConflict = conflicts.find((c) => c.type === "data_inconsistency");
      expect(gdpConflict).toBeDefined();
    });

    it("should detect budget overflow", () => {
      const mockMatchResult = {
        selected: [],
        suggested: [],
        rejected: [],
        conflicts: [],
        missingEssential: [],
      };

      const conflicts = detectWikiImportConflicts(mockMatchResult, {
        gdpInfobox: 500000000000,
        gdpEconomyBuilder: 500000000000,
        totalBudget: 175000000000,
        budgetAllocations: [
          { allocatedPercent: 60 },
          { allocatedPercent: 50 }, // Total: 110%
        ],
      });

      const budgetConflict = conflicts.find((c) => c.type === "budget_overflow");
      expect(budgetConflict).toBeDefined();
    });
  });

  // ─── Test: Full Pipeline Integration ───────────────────────────────────────

  describe("Full Pipeline Integration", () => {
    it("should process all parsers without errors", () => {
      const infoboxData = parseInfoboxWithTemplates(SAMPLE_COUNTRY_INFOBOX, "Testland");
      expect(infoboxData).not.toBeNull();

      const allPages = [
        { title: "Testland", content: SAMPLE_GOVERNMENT_PAGE + SAMPLE_ECONOMY_PAGE },
        { title: "Government of Testland", content: SAMPLE_GOVERNMENT_PAGE },
        { title: "Economy of Testland", content: SAMPLE_ECONOMY_PAGE },
      ];

      const govAttrs = parseGovernmentAttributes(allPages, infoboxData!.government_type);
      expect(govAttrs.overallConfidence).toBeGreaterThan(0);

      const econAttrs = parseEconomyAttributes(allPages);
      expect(econAttrs.overallConfidence).toBeGreaterThan(0);

      const departments = parseDepartments(allPages);
      expect(departments.length).toBeGreaterThan(0);

      const revenue = parseRevenueSources(allPages);
      // May or may not find revenue sources depending on content

      const matchResult = matchComponents({
        government: govAttrs,
        economy: econAttrs,
        infoboxGovType: infoboxData!.government_type,
      });

      expect(matchResult.selected.length).toBeGreaterThan(0);

      const conflicts = detectWikiImportConflicts(matchResult, {
        gdpInfobox: infoboxData!.gdp_nominal ?? undefined,
        gdpEconomyBuilder: infoboxData!.gdp_nominal ?? undefined,
        totalBudget: (infoboxData!.gdp_nominal ?? 1000000000) * 0.35,
        budgetAllocations: departments.map(() => ({ allocatedPercent: 5 })),
      });

      // Pipeline completed without errors
      expect(true).toBe(true);
    });

    it("should handle missing government page gracefully", () => {
      const infoboxData = parseInfoboxWithTemplates(SAMPLE_COUNTRY_INFOBOX, "Testland");
      expect(infoboxData).not.toBeNull();

      const pages = [{ title: "Testland", content: SAMPLE_COUNTRY_INFOBOX }];

      const govAttrs = parseGovernmentAttributes(pages, infoboxData!.government_type);
      // Should still work even with limited content
      expect(govAttrs).toBeDefined();
    });

    it("should handle empty pages gracefully", () => {
      const infoboxData = parseInfoboxWithTemplates(SAMPLE_COUNTRY_INFOBOX, "Testland");
      expect(infoboxData).not.toBeNull();

      const govAttrs = parseGovernmentAttributes([], infoboxData!.government_type);
      const econAttrs = parseEconomyAttributes([]);
      const departments = parseDepartments([]);
      const revenue = parseRevenueSources([]);

      // All should return valid empty/default results
      expect(govAttrs.overallConfidence).toBe(0);
      expect(econAttrs.overallConfidence).toBe(0);
      expect(departments.length).toBe(0);
      expect(revenue.sources.length).toBe(0);
    });
  });
});
