import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Project } from "ts-morph";
import {
  findDeadDeclarationsInSourceFile,
  analyzeRouterResidue,
  checkResidue,
  sortResidueBaseline,
  loadResidueBaseline,
} from "../../../scripts/audit/router-residue";

describe("Plan 157: Router Split Residue AST Guard & Cleanup", () => {
  let tempDir: string;
  let project: Project;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "router-residue-test-"));
    project = new Project({ useInMemoryFileSystem: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("1. Identifies dead unreferenced top-level functions", () => {
    const code = `
      function deadHelper() { return 42; }
      function liveHelper() { return 100; }
      export const router = {
        proc: () => liveHelper(),
      };
    `;
    const sf = project.createSourceFile("test1.ts", code);
    const dead = findDeadDeclarationsInSourceFile(sf, "test1.ts");

    expect(dead).toHaveLength(1);
    expect(dead[0].name).toBe("deadHelper");
    expect(dead[0].kind).toBe("function");
  });

  it("2. Preserves exported functions even if unreferenced internally", () => {
    const code = `
      export function sharedHelper() { return 1; }
      export const otherHelper = () => 2;
    `;
    const sf = project.createSourceFile("test2.ts", code);
    const dead = findDeadDeclarationsInSourceFile(sf, "test2.ts");

    expect(dead).toHaveLength(0);
  });

  it("3. Identifies dead unreferenced top-level variables", () => {
    const code = `
      const unusedConfig = { foo: "bar" };
      const usedConfig = { bar: "baz" };
      export const router = {
        proc: () => usedConfig.bar,
      };
    `;
    const sf = project.createSourceFile("test3.ts", code);
    const dead = findDeadDeclarationsInSourceFile(sf, "test3.ts");

    expect(dead).toHaveLength(1);
    expect(dead[0].name).toBe("unusedConfig");
    expect(dead[0].kind).toBe("variable");
  });

  it("4. Identifies dead unreferenced classes", () => {
    const code = `
      class UnusedService {
        run() {}
      }
      class UsedService {
        run() {}
      }
      export const router = {
        proc: () => new UsedService().run(),
      };
    `;
    const sf = project.createSourceFile("test4.ts", code);
    const dead = findDeadDeclarationsInSourceFile(sf, "test4.ts");

    expect(dead).toHaveLength(1);
    expect(dead[0].name).toBe("UnusedService");
    expect(dead[0].kind).toBe("class");
  });

  it("5. Detects chained dead helpers (helper called by dead function)", () => {
    const code = `
      function helperA() { return helperB(); }
      function helperB() { return 123; }
      export const router = {
        proc: () => "live",
      };
    `;
    const sf = project.createSourceFile("test5.ts", code);
    // Initial pass: helperA has 0 external refs
    const deadPass1 = findDeadDeclarationsInSourceFile(sf, "test5.ts");
    expect(deadPass1.map((d) => d.name)).toContain("helperA");

    // Once helperA is removed, helperB has 0 external refs
    sf.getFunction("helperA")?.remove();
    const deadPass2 = findDeadDeclarationsInSourceFile(sf, "test5.ts");
    expect(deadPass2.map((d) => d.name)).toContain("helperB");
  });

  it("6. Analyzes router directory files correctly", () => {
    const routersDir = path.join(tempDir, "src/server/api/routers/sample");
    fs.mkdirSync(routersDir, { recursive: true });

    fs.writeFileSync(
      path.join(routersDir, "sub.ts"),
      `function orphan() {} \n export const sampleSubRouter = {};`
    );

    const dead = analyzeRouterResidue({ rootDir: tempDir });
    expect(dead).toHaveLength(1);
    expect(dead[0].name).toBe("orphan");
    expect(dead[0].file).toBe("src/server/api/routers/sample/sub.ts");
  });

  it("7. Fails checkResidue on new unratcheted residue", () => {
    const routersDir = path.join(tempDir, "src/server/api/routers/sample");
    fs.mkdirSync(routersDir, { recursive: true });

    fs.writeFileSync(
      path.join(routersDir, "sub.ts"),
      `function orphan() {} \n export const sampleSubRouter = {};`
    );

    const baselinePath = "baseline.json";
    fs.writeFileSync(path.join(tempDir, baselinePath), JSON.stringify({}, null, 2));

    const errors = checkResidue(tempDir, baselinePath);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("NEW unused residue");
  });

  it("8. Passes checkResidue when residue is recorded in baseline", () => {
    const routersDir = path.join(tempDir, "src/server/api/routers/sample");
    fs.mkdirSync(routersDir, { recursive: true });

    fs.writeFileSync(
      path.join(routersDir, "sub.ts"),
      `function orphan() {} \n export const sampleSubRouter = {};`
    );

    const baselinePath = "baseline.json";
    fs.writeFileSync(
      path.join(tempDir, baselinePath),
      JSON.stringify(
        {
          "src/server/api/routers/sample/sub.ts": ["orphan"],
        },
        null,
        2
      )
    );

    const errors = checkResidue(tempDir, baselinePath);
    expect(errors).toHaveLength(0);
  });

  it("9. Deterministically sorts baseline entries", () => {
    const input = {
      "src/server/api/routers/b.ts": ["zHelper", "aHelper"],
      "src/server/api/routers/a.ts": ["xHelper"],
    };

    const sorted = sortResidueBaseline(input);
    expect(Object.keys(sorted)).toEqual([
      "src/server/api/routers/a.ts",
      "src/server/api/routers/b.ts",
    ]);
    expect(sorted["src/server/api/routers/b.ts"]).toEqual(["aHelper", "zHelper"]);
  });
});
