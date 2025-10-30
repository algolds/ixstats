#!/usr/bin/env tsx
import fs from "fs";
import path from "path";

function readJSONSafe(p: string) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {}
  return null;
}

async function main() {
  const outDir = path.resolve("scripts/audit/reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `consolidated-${now}.json`);

  const playwright = readJSONSafe("playwright-report/report.json");
  const wiring = (() => {
    const files = fs
      .readdirSync("scripts/audit/reports", { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.startsWith("live-wiring-report-"))
      .map((f) => path.join("scripts/audit/reports", f.name))
      .sort()
      .pop();
    return files ? readJSONSafe(files) : null;
  })();
  const invoke = (() => {
    const files = fs
      .readdirSync(".", { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.startsWith("audit-results-") && f.name.endsWith(".json"))
      .map((f) => path.join(".", f.name))
      .sort()
      .pop();
    return files ? readJSONSafe(files) : null;
  })();

  const consolidated = {
    timestamp: new Date().toISOString(),
    playwright,
    wiring,
    invoke,
  };

  fs.writeFileSync(outPath, JSON.stringify(consolidated, null, 2));
  console.log(`Consolidated report written: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
