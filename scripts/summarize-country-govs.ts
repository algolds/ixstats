import fs from "fs";

const profiles = JSON.parse(fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/country_governance_profiles.json", "utf8"));

const sampledCountries = [
  "Urcea",
  "Burgundie",
  "Cartadania",
  "Yonderre",
  "Faneria",
  "Kiravia",
  "Daxia",
  "Carna",
  "Varshan",
  "Castadilla",
  "Pelaxia",
  "Tierrador",
  "Nasastan",
  "Olmeria",
  "Caldera",
  "Puertego",
  "Hendalarsk",
];

for (const c of sampledCountries) {
  const p = profiles[c];
  if (!p) {
    console.log(`\n=== ${c}: NOT FOUND ===`);
    continue;
  }
  console.log(`\n=== ${c} ===`);
  console.log(`  Gov Type: ${p.governanceData.governmentType || "N/A"}`);
  console.log(`  Head of State: ${p.governanceData.headOfState || "N/A"}`);
  console.log(`  Head of Gov: ${p.governanceData.headOfGovernment || "N/A"}`);
  console.log(`  Legislature: ${p.governanceData.legislature || "N/A"}`);
  console.log(`  Constitution: ${p.governanceData.constitution || "N/A"}`);
  console.log(`  Gov Article: ${p.governmentArticle?.title || "None"}`);
  console.log(`  Politics Article: ${p.politicsArticle?.title || "None"}`);
  console.log(`  Constitution Article: ${p.constitutionArticle?.title || "None"}`);
  console.log(`  Other Gov Articles: ${p.otherGovArticles.length} (sample: ${p.otherGovArticles.slice(0, 4).map((a: any) => a.title).join(", ")})`);
}
