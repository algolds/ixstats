import fs from "fs";

const data = JSON.parse(fs.readFileSync("/tmp/full_political_audit.json", "utf8"));

const keyArticles = [
  "Government_of_Caphiria",
  "Politics_of_Caphiria",
  "Government_of_Burgundie",
  "Politics_of_Burgundie",
  "Politics_of_Urcea",
  "Politics_of_Faneria",
  "Politics_of_Yonderre",
  "Cartadania",
  "Caphiria",
  "Urcea",
  "Burgundie",
  "Yonderre",
  "Faneria",
  "Federation_of_Kiravia",
  "Kiravia",
  "Thervala",
  "Daxia",
  "Pelaxia"
];

let out = "";
for (const title of keyArticles) {
  const art = data.articles.find(a => a.title.toLowerCase() === title.toLowerCase());
  if (art) {
    out += `\n=========================================\n`;
    out += `PAGE: ${art.title}\n`;
    out += `CATEGORIES: ${art.categories.join(", ")}\n`;
    out += `=========================================\n`;
    out += art.snippet.slice(0, 1500) + "\n";
  } else {
    out += `\n[NOT FOUND IN AUDIT: ${title}]\n`;
  }
}

fs.writeFileSync("/tmp/key_governance_profiles.txt", out);
console.log("Wrote key governance profiles.");
