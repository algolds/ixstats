import fs from "fs";

const data = JSON.parse(fs.readFileSync("/tmp/full_political_audit.json", "utf8"));
const entities = JSON.parse(fs.readFileSync("/tmp/political_entities.json", "utf8"));

const targetTitles = [
  "Organicism",
  "Crown_Liberalism",
  "Nolanism",
  "Urcean_socialist_philosophy",
  "Foralism",
  "Commarcho_Capitalism",
  "Velvetine_Socialism",
  "Political_ideologies_in_Castadilla",
  "Kirosocialism",
  "Shaftonist_democracy",
  "Adaptivism",
  "Bairdism",
  "Counter_Empire",
  "Kallistocracy",
  "Limited_Divinity",
  "Universal_Nationalism",
  "Justice_League",
  "Fatherland_Party_(Yonderre)",
  "Gothic_People's_Party",
  "Caphirian_Imperial_League",
  "National_Pact_(Urcea)",
  "Solidarity_Party_(Urcea)",
  "Julian_Party_(Urcea)",
  "Social_Labor_Party_(Urcea)",
  "Retainer_Party_(Urcea)",
  "Party_of_Courtiers_and_Magistrates",
  "National_Falangist_Party"
];

const found = data.articles.filter(a => targetTitles.map(t => t.toLowerCase()).includes(a.title.toLowerCase()));

let report = "";
for (const art of found) {
  report += `\n==================================================\n`;
  report += `ARTICLE: ${art.title}\n`;
  report += `CATEGORIES: ${art.categories.join(", ")}\n`;
  report += `==================================================\n`;
  report += art.snippet + "\n";
  if (art.snippet.length >= 1000) {
    report += `\n[... continues ...]\n`;
  }
}

fs.writeFileSync("/tmp/target_ideologies_full.txt", report);
console.log(`Wrote ${found.length} articles to /tmp/target_ideologies_full.txt`);
