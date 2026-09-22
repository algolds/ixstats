import * as fs from "fs";

const docPath = "/home/jxsig/projects/ixstats/docs/reference/caphiria-geographical-report.md";
const newSecPath = "/home/jxsig/projects/ixstats/scripts/reports/24-regions-section.md";

const doc = fs.readFileSync(docPath, "utf-8");
const newSec = fs.readFileSync(newSecPath, "utf-8").trim();

const startMarker = "## Regional and provincial geographical reports";
const endMarker = "## Agricultural potential and habitability";

const startIndex = doc.indexOf(startMarker);
const endIndex = doc.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found! startIndex:", startIndex, "endIndex:", endIndex);
  process.exit(1);
}

// Keep the separator before Agricultural potential
const before = doc.slice(0, startIndex);
const after = doc.slice(endIndex);

const updated = before + newSec + "\n\n---\n\n" + after;

fs.writeFileSync(docPath, updated);
console.log("Successfully replaced provincial section with the 24 actual map editor regions.");
