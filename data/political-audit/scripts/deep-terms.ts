import fs from "fs";

const data = JSON.parse(fs.readFileSync("/tmp/full_political_audit.json", "utf8"));

// Search for articles with specific deep philosophical concepts
function findArticlesContaining(query: string, max: number = 5) {
  const q = query.toLowerCase();
  const matches = data.articles.filter(a => a.snippet.toLowerCase().includes(q) || a.title.toLowerCase().includes(q));
  console.log(`\n=== Matches for "${query}" (${matches.length} found) ===`);
  for (const m of matches.slice(0, max)) {
    console.log(`[${m.title}]`);
    const idx = m.snippet.toLowerCase().indexOf(q);
    const start = Math.max(0, idx - 100);
    const end = Math.min(m.snippet.length, idx + 200);
    console.log("..." + m.snippet.substring(start, end).replace(/\n/g, " ") + "...");
  }
}

findArticlesContaining("organicism");
findArticlesContaining("quaternalis");
findArticlesContaining("societates dominanae");
findArticlesContaining("synodalism");
findArticlesContaining("shafton");
findArticlesContaining("kirosocialis");
