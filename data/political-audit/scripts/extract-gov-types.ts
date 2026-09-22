import fs from "fs";

const data = JSON.parse(fs.readFileSync("/tmp/full_political_audit.json", "utf8"));

const govTypes: Record<string, { country: string; govType: string }> = {};

for (const a of data.articles) {
  // Check if it's a country page
  const text = a.snippet;
  if (!text.includes("{{Infobox country")) continue;

  const m = text.match(/\|\s*government_type\s*=\s*([^\n|]+)/i) || 
            text.match(/\|\s*government\s*=\s*([^\n|]+)/i);
  if (m) {
    const gov = m[1].replace(/\[\[/g, "").replace(/\]\]/g, "").replace(/\{\{wp\|/gi, "").replace(/\}\}/g, "").trim();
    govTypes[a.title] = { country: a.title, govType: gov };
  }
}

console.log(`Found ${Object.keys(govTypes).length} countries with government_type in infobox:`);
for (const [c, g] of Object.entries(govTypes)) {
  console.log(`${c.padEnd(25)}: ${g.govType}`);
}
