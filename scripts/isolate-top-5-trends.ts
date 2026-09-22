import fs from "fs";

const countryProfiles = JSON.parse(
  fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/country_governance_profiles.json", "utf8")
);

const polEntities = JSON.parse(
  fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/category_politics_entities.json", "utf8")
);

const fullCorpusEntities = JSON.parse(
  fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/entire_wiki_political_entities.json", "utf8")
);

const spectrumStats = JSON.parse(
  fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/entire_wiki_spectrum_stats.json", "utf8")
);

console.log("=== ISOLATING EMPIRICAL TRENDLINES ACROSS THE WORLD ===");

// 1. Legislature Types
const legTypes: Record<string, number> = {};
const govTypes: Record<string, number> = {};
const sovereigntySources: Record<string, number> = {};

for (const [cName, p] of Object.entries(countryProfiles as Record<string, any>)) {
  const gov = p.governanceData?.governmentType || p.mainArticle?.infoboxCountry?.government_type;
  const leg = p.governanceData?.legislature || p.mainArticle?.infoboxCountry?.legislature;
  const sov = p.mainArticle?.infoboxCountry?.sovereignty_type;

  if (gov) {
    const cleanGov = gov.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
    govTypes[cleanGov] = (govTypes[cleanGov] || 0) + 1;
  }
  if (leg) {
    const cleanLeg = leg.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
    legTypes[cleanLeg] = (legTypes[cleanLeg] || 0) + 1;
  }
  if (sov) {
    const cleanSov = sov.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
    sovereigntySources[cleanSov] = (sovereigntySources[cleanSov] || 0) + 1;
  }
}

console.log("\n--- Sample Government Types ---");
console.log(Object.entries(govTypes).slice(0, 20));

console.log("\n--- Sample Legislatures ---");
console.log(Object.entries(legTypes).slice(0, 20));

// 2. Ideological Platforms in Parties (56 Category:Politics + 97 Corpus)
const allParties = [...polEntities.parties, ...(fullCorpusEntities.parties || [])];
console.log(`Total parties analyzed: ${allParties.length}`);

const partyIdeologies: Record<string, number> = {};
const partyPositions: Record<string, number> = {};

for (const party of allParties) {
  const ideo = party.infobox?.ideology || "";
  const pos = party.infobox?.position || "";

  if (ideo) {
    const tokens = ideo.split(/<br\s*\/?>|\n|\*|,/).map((t: string) => t.replace(/\[\[|\]\]|\{\{wp\||\}\}/g, "").trim()).filter(Boolean);
    for (const t of tokens) {
      if (t.length > 2 && t.length < 40) {
        partyIdeologies[t] = (partyIdeologies[t] || 0) + 1;
      }
    }
  }
  if (pos) {
    const cleanPos = pos.replace(/\[\[|\]\]|\{\{wp\||\}\}/g, "").trim();
    if (cleanPos) partyPositions[cleanPos] = (partyPositions[cleanPos] || 0) + 1;
  }
}

console.log("\n--- Top Party Ideological Markers ---");
const sortedIdeos = Object.entries(partyIdeologies).sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(sortedIdeos);

console.log("\n--- Vocabulary Distribution from 4,725 Articles ---");
console.log(spectrumStats.vocabularyCounts);

// 3. Examine Country Governance Patterns Across Continents
const regionalPatterns: Record<string, any[]> = {
  Levantia: [],
  Sarpedon: [],
  Crona: [],
  Audonia: [],
  Coscivia_Orient: [],
};

for (const [cName, p] of Object.entries(countryProfiles as Record<string, any>)) {
  const mainText = p.mainArticle?.snippet || "";
  const govText = p.governmentArticle?.snippet || "";
  const otherTexts = p.otherGovArticles.map((a: any) => a.snippet).join(" ");
  const allText = (mainText + " " + govText + " " + otherTexts).toLowerCase();

  const countryData = {
    country: cName,
    hasMonarch: allText.includes("king") || allText.includes("monarch") || allText.includes("emperor") || allText.includes("prince") || allText.includes("archduke") || allText.includes("imperator"),
    hasRepublic: allText.includes("republic") || allText.includes("president"),
    hasCouncilOrDiet: allText.includes("council") || allText.includes("diet") || allText.includes("forgaitherin") || allText.includes("rada") || allText.includes("corcillum") || allText.includes("stanora"),
    hasBicameral: allText.includes("bicameral") || allText.includes("senate") && allText.includes("assembly") || allText.includes("commons") && allText.includes("peerage"),
    hasUnicameral: allText.includes("unicameral"),
    hasReligiousSanction: allText.includes("catholic") || allText.includes("church") || allText.includes("arzalist") || allText.includes("divine") || allText.includes("holy") || allText.includes("theocrat") || allText.includes("zmor"),
    hasFederalOrFederation: allText.includes("feder") || allText.includes("ethnofeder") || allText.includes("confeder") || allText.includes("provinc") || allText.includes("fuero"),
    hasUnitaryOrImperial: allText.includes("unitary") || allText.includes("imperium") || allText.includes("central"),
    hasSocialistOrWelfare: allText.includes("socialis") || allText.includes("welfare") || allText.includes("distribut") || allText.includes("tripart") || allText.includes("bairdis") || allText.includes("egalitarian"),
    hasMercantileOrCommerce: allText.includes("commerce") || allText.includes("trade") || allText.includes("mercant") || allText.includes("market") || allText.includes("thalatto"),
  };

  // Assign rough continent
  if (["Urcea", "Burgundie", "Faneria", "Yonderre", "Hendalarsk", "Fiannria", "Caergwynn", "New_Harren", "Rhotia", "Lapody"].includes(cName)) {
    regionalPatterns.Levantia.push(countryData);
  } else if (["Caphiria", "Cartadania", "Castadilla", "Pelaxia", "Puertego", "Vallejar", "Canespa", "Slaconia"].includes(cName)) {
    regionalPatterns.Sarpedon.push(countryData);
  } else if (["Carna", "Varshan", "Tierrador", "Alstin", "Argyrea", "Metzetta"].includes(cName)) {
    regionalPatterns.Crona.push(countryData);
  } else if (["Nasastan", "Bulkh", "Yanuban", "Timbia", "Avonia", "Rusana"].includes(cName)) {
    regionalPatterns.Audonia.push(countryData);
  } else if (["Kiravia", "Daxia", "Oyashima", "Battganuur", "Kandara", "Slaconia"].includes(cName)) {
    regionalPatterns.Coscivia_Orient.push(countryData);
  }
}

console.log("\n--- Regional Feature Counts ---");
for (const [reg, list] of Object.entries(regionalPatterns)) {
  console.log(`\n${reg} (${list.length} countries):`);
  const sum = (key: string) => list.filter(c => c[key]).length;
  console.log(`  Monarchical/Imperial: ${sum("hasMonarch")}`);
  console.log(`  Republican: ${sum("hasRepublic")}`);
  console.log(`  Council/Diet/Corcillum/Stanora: ${sum("hasCouncilOrDiet")}`);
  console.log(`  Bicameral/Multicameral: ${sum("hasBicameral")}`);
  console.log(`  Religious/Sacral Legitimacy: ${sum("hasReligiousSanction")}`);
  console.log(`  Federal/Decentralized: ${sum("hasFederalOrFederation")}`);
  console.log(`  Socialist/Distributive: ${sum("hasSocialistOrWelfare")}`);
  console.log(`  Mercantile/Commercial: ${sum("hasMercantileOrCommerce")}`);
}
