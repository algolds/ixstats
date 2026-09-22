import fs from "fs";

const data = JSON.parse(fs.readFileSync("/tmp/full_political_audit.json", "utf8"));

const caphiriaArticles = data.articles.filter(a => 
  a.title.toLowerCase().includes("caphiria") || 
  a.categories.some(c => c.toLowerCase().includes("caphiria"))
);

console.log(`Found ${caphiriaArticles.length} Caphiria-related articles.`);
for (const a of caphiriaArticles) {
  if (a.title.includes("Politics") || a.title.includes("Government") || a.title.includes("Imper") || a.title.includes("Senate") || a.title.includes("Law") || a.title.includes("Constitution") || a.title.includes("Society") || a.title.includes("Order")) {
    console.log(`- ${a.title}: categories=[${a.categories.join(", ")}]`);
  }
}

// Check Cartadania articles too
const cartadaniaArticles = data.articles.filter(a =>
  a.title.toLowerCase().includes("cartadania") ||
  a.categories.some(c => c.toLowerCase().includes("cartadania"))
);
console.log(`\nFound ${cartadaniaArticles.length} Cartadania-related articles.`);
for (const a of cartadaniaArticles) {
  if (a.title.includes("Politics") || a.title.includes("Government") || a.title.includes("Party") || a.title.includes("Syndic") || a.title.includes("President") || a.title.includes("Assembly")) {
    console.log(`- ${a.title}: categories=[${a.categories.join(", ")}]`);
  }
}
