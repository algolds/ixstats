/** @jest-environment node */
import fs from "fs";
import path from "path";

/**
 * D3: src/lib/wiki-os writes no `console.log`. The cron runner logs the cycle result (`summarizeResult`) and
 * `writeStatus` stores it, so a log line inside a service only adds noise. `console.warn` and `console.error` stay
 * allowed for real failures. Tests are skipped; text inside comments and string literals does not count.
 */
const ROOT = path.resolve(__dirname, "../../lib/wiki-os");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
    return isSource ? [full] : [];
  });
}

/** Blank out comments and strings (same length, newlines kept) so a match is real code. */
function codeOnly(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g,
    (m) => m.replace(/[^\n]/g, " ")
  );
}

describe("src/lib/wiki-os has no console.log", () => {
  it("finds the sources it scans", () => {
    expect(walk(ROOT).length).toBeGreaterThan(10);
  });

  it("calls console.log nowhere", () => {
    const hits = walk(ROOT).flatMap((file) =>
      codeOnly(fs.readFileSync(file, "utf8"))
        .split("\n")
        .flatMap((line, i) => (/\bconsole\s*\.\s*log\s*\(/.test(line) ? [`${path.relative(ROOT, file)}:${i + 1}`] : []))
    );
    expect(hits).toEqual([]);
  });
});
