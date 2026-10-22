/**
 * audit:arch, the CI architecture guard: the god-file size ratchet (Plan 154), the cross-router import boundary
 * (Plan 153, AST-backed) and the router split residue check (Plan 157).
 *
 * Folds audit-arch-imports and router-residue.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Project } from "ts-morph";
import {
  analyzeRouterImports,
  bootstrapBaseline,
  checkSizes,
  isScannedFile,
  updateBaseline,
  walk,
} from "../../../scripts/audit/audit-arch";
import {
  checkResidue,
  findDeadDeclarationsInSourceFile,
} from "../../../scripts/audit/router-residue";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-arch-test-"));
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

function writeFile(relative: string, content: string) {
  fs.mkdirSync(path.dirname(path.join(tempDir, relative)), { recursive: true });
  fs.writeFileSync(path.join(tempDir, relative), content);
}

const readJson = (relative: string) =>
  JSON.parse(fs.readFileSync(path.join(tempDir, relative), "utf8")) as Record<string, number>;

describe("the size ratchet", () => {
  it("scans .ts and .tsx sources only, never tests, specs, declarations or test directories", () => {
    expect(["component.tsx", "service.ts"].map(isScannedFile)).toEqual([true, true]);
    expect(
      ["service.test.ts", "component.test.tsx", "types.d.ts", "service.spec.ts"].map(isScannedFile)
    ).toEqual([false, false, false, false]);
    writeFile("src/app/page.tsx", "line1\nline2\n");
    writeFile("src/app/__tests__/page.test.tsx", "line1\nline2\n");
    expect(walk("src/app", tempDir)).toEqual(["src/app/page.tsx"]);
  });

  it("fails a god file that grew past its baseline", () => {
    writeFile("src/server/api/routers/routerA.ts", "line\n".repeat(750));
    writeFile("baseline.json", JSON.stringify({ "src/server/api/routers/routerA.ts": 720 }));
    const errors = checkSizes(tempDir, "baseline.json");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("GROWN past baseline");
  });

  it("ratchets the baseline down when a file shrinks and drops it once under its ceiling", () => {
    writeFile("src/server/api/routers/fileA.ts", "line\n".repeat(740));
    writeFile("src/server/api/routers/fileB.ts", "line\n".repeat(650));
    writeFile(
      "baseline.json",
      JSON.stringify({
        "src/server/api/routers/fileA.ts": 780,
        "src/server/api/routers/fileB.ts": 750,
      })
    );
    updateBaseline(tempDir, "baseline.json");
    const updated = readJson("baseline.json");
    expect(updated["src/server/api/routers/fileA.ts"]).toBe(740);
    expect(updated["src/server/api/routers/fileB.ts"]).toBeUndefined();
  });

  it("bootstraps a newly covered root at today's sizes", () => {
    writeFile("src/app/AppMonolith.tsx", "line\n".repeat(750));
    writeFile("src/hooks/useGodHook.ts", "line\n".repeat(550));
    bootstrapBaseline(tempDir, "baseline.json");
    expect(readJson("baseline.json")).toMatchObject({
      "src/app/AppMonolith.tsx": 750,
      "src/hooks/useGodHook.ts": 550,
    });
  });
});

describe("the cross-router import boundary", () => {
  const fixturesRoot = path.resolve(__dirname, "../fixtures/audit-arch/imports");
  const violations = () =>
    analyzeRouterImports({ rootDir: fixturesRoot, routersRelDir: "src/server/api/routers" });

  it("flags every cross-router form: alias, relative, dynamic, export, flat and grouped", () => {
    const found = violations();
    expect(found).toHaveLength(8);
    expect(found.filter((v) => v.importer.endsWith("groupB/index.ts")).map((v) => v.kind)).toEqual([
      "import",
      "import",
      "import",
      "export",
      "dynamic-import",
    ]);
    expect(found.filter((v) => v.importer.endsWith("flatA.ts")).map((v) => v.kind)).toEqual([
      "import",
      "import",
      "import",
    ]);
    expect(found.filter((v) => v.importer.endsWith("flatB.ts"))).toHaveLength(0);
  });

  it("ignores comments and strings that only look like imports", () => {
    expect(violations().filter((v) => v.importer.includes("groupA"))).toHaveLength(0);
  });
});

describe("router split residue", () => {
  const dead = (code: string) =>
    findDeadDeclarationsInSourceFile(
      new Project({ useInMemoryFileSystem: true }).createSourceFile("router.ts", code),
      "router.ts"
    );
  const LIVE = "export const router = { proc: () => live() };";

  it.each([
    [
      "function",
      "function deadHelper() { return 42; }\nfunction live() { return 1; }",
      "deadHelper",
    ],
    ["variable", 'const unusedConfig = { foo: "bar" };\nconst live = () => 1;', "unusedConfig"],
    ["class", "class UnusedService { run() {} }\nfunction live() { return 1; }", "UnusedService"],
  ])("finds an unreferenced top-level %s", (kind, code, name) => {
    expect(dead(`${code}\n${LIVE}`).map((d) => [d.kind, d.name])).toEqual([[kind, name]]);
  });

  it("keeps exported helpers even when nothing in the file uses them", () => {
    expect(
      dead("export function sharedHelper() { return 1; }\nexport const other = () => 2;")
    ).toEqual([]);
  });

  it("finds a chain of dead helpers one link at a time", () => {
    const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile(
      "router.ts",
      'function helperA() { return helperB(); }\nfunction helperB() { return 123; }\nexport const router = { proc: () => "live" };'
    );
    expect(findDeadDeclarationsInSourceFile(sf, "router.ts").map((d) => d.name)).toContain(
      "helperA"
    );
    sf.getFunction("helperA")?.remove();
    expect(findDeadDeclarationsInSourceFile(sf, "router.ts").map((d) => d.name)).toContain(
      "helperB"
    );
  });

  it("fails CI on new residue in a router directory, and passes once it is in the baseline", () => {
    writeFile(
      "src/server/api/routers/sample/sub.ts",
      "function orphan() {} \n export const sampleSubRouter = {};"
    );
    writeFile("baseline.json", "{}");
    const errors = checkResidue(tempDir, "baseline.json");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("NEW unused residue");

    writeFile(
      "baseline.json",
      JSON.stringify({ "src/server/api/routers/sample/sub.ts": ["orphan"] })
    );
    expect(checkResidue(tempDir, "baseline.json")).toHaveLength(0);
  });
});
