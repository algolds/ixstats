/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";
import {
  LiteralParseError,
  MAX_LITERAL_DEPTH,
  readBoundLiteral,
} from "~/lib/realms/sources/js-literal";
import { fetchRepoFile, rawGithubUrl, SourceFetchError } from "~/lib/realms/sources/fetch";

const FIXTURES = path.resolve(__dirname, "../../../fixtures/realm-sources/eurth-map");
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");
/** One literal as a source file binds it. */
const readLiteral = (literal: string) => readBoundLiteral(`const value = ${literal};`, "value");

describe("readBoundLiteral: the source's own files", () => {
  it("reads the nation table with comments, quoted keys, nulls, extra fields and trailing commas", () => {
    const nations = readBoundLiteral(fixture("nations.js"), "nations") as Record<string, any>;
    expect(Object.keys(nations)).toEqual([
      "Tavok",
      "Kiziauke",
      "Mito",
      "Bainbridge-Islands",
      "Deseti",
    ]);
    expect(nations.Tavok).toEqual({
      name: "Republic of Tavok",
      color: "#0a3d2a",
      population: 48000000,
      gdppc: 39500,
      landArea: 248153,
      capital: "Tyyrik",
      iiwikiLink: "https://iiwiki.com/w/Tavok",
    });
    expect(nations.Mito.npc).toBe(true);
    expect(nations.Mito.secondaryFields).toEqual(["capital", "gdppc", "landArea"]);
    expect(nations.Deseti.population).toBeNull();
    expect(nations.Kiziauke.iiwikiLink).toBe("https://iiwiki.com/w/Kíziáuke");
  });

  it("reads an exported array and ignores the code after it (never evaluated)", () => {
    const orgs = readBoundLiteral(fixture("organizations.js"), "ORGANIZATIONS") as any[];
    expect(orgs.map((o) => o.id)).toEqual(["aurelian-league", "west-argic-security-pact"]);
    expect(orgs[1].members).toContain("Haitu");
  });

  it("skips a binding of the same name inside a function, a string or a comment", () => {
    const source = `
      // const data = { fake: 1 };
      const note = "const data = { alsoFake: 2 }";
      function f() { const data = { inner: 3 }; }
      export const data = { real: 4 };`;
    expect(readBoundLiteral(source, "data")).toEqual({ real: 4 });
  });
});

describe("readBoundLiteral: values", () => {
  it("gives objects no prototype, so a __proto__ key is an own key and pollutes nothing", () => {
    const value = readLiteral(
      `{ "__proto__": { "polluted": true }, constructor: { prototype: { x: 1 } } }`
    ) as any;
    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.keys(value)).toEqual(["__proto__", "constructor"]);
    expect(({} as any).polluted).toBeUndefined();
    expect((Object.prototype as any).polluted).toBeUndefined();
  });
});

describe("readBoundLiteral: hostile input is refused, never run", () => {
  const refused: Array<[string, string]> = [
    ["a function call", `{ a: fetch("https://evil.example") }`],
    ["an identifier reference", `{ a: process }`],
    ["a template literal", "{ a: `${process.exit(1)}` }"],
    ["a computed key", `{ ["a"]: 1 }`],
    ["code after the literal on its line", `{ a: 1 } + alert(1)`],
  ];
  it.each(refused)("refuses %s", (_label, source) => {
    expect(() => readLiteral(source)).toThrow(LiteralParseError);
  });

  it("refuses nesting deeper than the limit instead of overflowing the stack", () => {
    const deep = "[".repeat(MAX_LITERAL_DEPTH + 5) + "]".repeat(MAX_LITERAL_DEPTH + 5);
    expect(() => readLiteral(deep)).toThrow(/nested too deeply/);
    const veryDeep = "[".repeat(200_000);
    expect(() => readLiteral(veryDeep)).toThrow(LiteralParseError);
  });
});

describe("fetching a source repository's files", () => {
  const file = {
    repo: "a-seth-harrison/eurth-map",
    ref: "main",
    path: "eurth-map/src/data/nations.js",
  };
  function response(
    body: string,
    init: { status?: number; headers?: Record<string, string> } = {}
  ) {
    return new Response(body, { status: init.status ?? 200, headers: init.headers });
  }
  describe("rawGithubUrl", () => {
    it("builds a raw.githubusercontent.com URL from a validated repo, ref and path", () => {
      expect(rawGithubUrl(file).toString()).toBe(
        "https://raw.githubusercontent.com/a-seth-harrison/eurth-map/main/eurth-map/src/data/nations.js"
      );
      expect(rawGithubUrl({ ...file, path: "a dir/file name.js" }).pathname).toContain(
        "a%20dir/file%20name.js"
      );
    });

    it.each([
      ["a repo with a host", { ...file, repo: "evil.example/x/y" }],
      ["a path with ..", { ...file, path: "eurth-map/../../etc/passwd" }],
      ["a URL as path", { ...file, path: "https://evil.example/x" }],
    ])("refuses %s", (_label, bad) => {
      expect(() => rawGithubUrl(bad)).toThrow(SourceFetchError);
    });
  });
  describe("fetchRepoFile", () => {
    it("refuses a redirect (it could point at another host)", async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValue(
          response("", { status: 302, headers: { location: "https://evil.example/" } })
        );
      await expect(fetchRepoFile(file, { fetchImpl })).rejects.toThrow(/redirect/);
    });

    it("refuses a file over the size cap, by header or while streaming", async () => {
      const declared = jest
        .fn()
        .mockResolvedValue(response("x", { headers: { "content-length": String(10_000_000) } }));
      await expect(fetchRepoFile(file, { fetchImpl: declared, maxBytes: 1000 })).rejects.toThrow(
        /larger/
      );
      const streamed = jest.fn().mockResolvedValue(response("x".repeat(2000)));
      await expect(fetchRepoFile(file, { fetchImpl: streamed, maxBytes: 1000 })).rejects.toThrow(
        /larger/
      );
    });
  });
});
