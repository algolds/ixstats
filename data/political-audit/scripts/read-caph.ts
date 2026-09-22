import fs from "fs";

const data = JSON.parse(fs.readFileSync("/tmp/full_political_audit.json", "utf8"));

const caphTarget = data.articles.filter(a => 
  a.title === "Government_of_Caphiria" ||
  a.title === "Vestiary_Laws_(Caphiria)" ||
  a.title === "Senate_of_Caphiria" ||
  a.title === "Second_Imperium" ||
  a.title === "Caphiria"
);

for (const art of caphTarget) {
  console.log(`\n================== ${art.title} ==================`);
  console.log(art.snippet.slice(0, 1500));
}
