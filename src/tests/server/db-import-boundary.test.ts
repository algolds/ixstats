import fs from "fs";
import path from "path";

describe("db-import-boundary", () => {
  const dbSourcePath = path.resolve(__dirname, "../../server/db.ts");
  const dbSource = fs.readFileSync(dbSourcePath, "utf-8");

  it("does not import from broad system barrel ~/lib/system", () => {
    // Should not import from ~/lib/system or ~/lib/system/
    expect(dbSource).not.toMatch(/from\s+["']~\/lib\/system["']/);
    expect(dbSource).not.toMatch(/from\s+["']~\/lib\/system\/index["']/);
  });

  it("imports queryMonitor directly from leaf module ~/lib/system/query-monitor", () => {
    expect(dbSource).toMatch(
      /import\s+\{\s*queryMonitor\s*\}\s+from\s+["']~\/lib\/system\/query-monitor["']/
    );
  });

  it("imports isDevMode directly from leaf module ~/lib/system/dev-memory-config", () => {
    expect(dbSource).toMatch(
      /import\s+\{\s*isDevMode\s*\}\s+from\s+["']~\/lib\/system\/dev-memory-config["']/
    );
  });
});
