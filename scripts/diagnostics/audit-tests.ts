import fs from "fs";
import path from "path";

function walk(dir: string): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f) || f.endsWith(".ts") || f.endsWith(".tsx")) files.push(full);
  }
  return files;
}

const testFiles = walk("src/tests");
const allSrc = walk("src");
const allTestFiles = allSrc.filter(f => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f));

console.log(`=== TOTAL TEST FILES IN src/tests: ${testFiles.length} ===`);
console.log(`=== TOTAL TEST FILES ACROSS ENTIRE src/: ${allTestFiles.length} ===`);

const testStats = testFiles.map(f => ({
  file: f,
  rel: path.relative("src/tests", f),
  lines: fs.readFileSync(f, "utf8").split("\n").length,
  size: fs.statSync(f).size
})).sort((a, b) => b.lines - a.lines);

console.log("\n=== ALL FILES IN src/tests ===");
testStats.forEach(f => console.log(`${f.lines.toString().padStart(4)} lines | ${f.rel}`));

// Tests outside src/tests
const outsideTests = allTestFiles.filter(f => !f.startsWith("src/tests/"));
console.log(`\n=== TESTS OUTSIDE src/tests (${outsideTests.length}) ===`);
outsideTests.forEach(f => console.log(`- ${f}`));
