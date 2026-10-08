/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";
import {
  LiteralParseError,
  MAX_LITERAL_DEPTH,
  readBoundLiteral,
  readLiteral,
} from "~/lib/realms/sources/js-literal";

const FIXTURES = path.resolve(__dirname, "../../../fixtures/realm-sources/eurth-map");
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

describe("readBoundLiteral: the source's own files", () => {
  it("reads the nation table with comments, quoted keys, nulls, extra fields and trailing commas", () => {
    const nations = readBoundLiteral(fixture("nations.js"), "nations") as Record<string, any>;
    expect(Object.keys(nations)).toEqual(["Tavok", "Kiziauke", "Mito", "Bainbridge-Islands", "Deseti"]);
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

  it("refuses a file without the binding", () => {
    expect(() => readBoundLiteral("const other = {};", "nations")).toThrow(LiteralParseError);
  });

  it("refuses a transformed literal unless told to read the plain literal and ignore the transform", () => {
    const source = `export const ZONES = [{ code: "Af" }].map((z) => ({ ...z, evil: run() }));`;
    expect(() => readBoundLiteral(source, "ZONES")).toThrow(/after the literal/);
    expect(readBoundLiteral(source, "ZONES", "ignore")).toEqual([{ code: "Af" }]);
  });
});

describe("readLiteral: values", () => {
  it("reads escapes, signs, decimals, exponents and single quotes", () => {
    expect(readLiteral(`{ a: 'it\\'s', b: "\\u00e9\\x41\\n", c: -1.5e3, d: .5, e: 1_000 }`)).toEqual({
      a: "it's",
      b: "éA\n",
      c: -1500,
      d: 0.5,
      e: 1000,
    });
  });

  it("gives objects no prototype, so a __proto__ key is an own key and pollutes nothing", () => {
    const value = readLiteral(`{ "__proto__": { "polluted": true }, constructor: { prototype: { x: 1 } } }`) as any;
    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.keys(value)).toEqual(["__proto__", "constructor"]);
    expect(({} as any).polluted).toBeUndefined();
    expect((Object.prototype as any).polluted).toBeUndefined();
  });
});

describe("readLiteral: hostile input is refused, never run", () => {
  const refused: Array<[string, string]> = [
    ["a function call", `{ a: fetch("https://evil.example") }`],
    ["an identifier reference", `{ a: process }`],
    ["undefined", `{ a: undefined }`],
    ["a template literal", "{ a: `${process.exit(1)}` }"],
    ["a getter", `{ get a() { return 1 } }`],
    ["a method", `{ a() { return 1 } }`],
    ["a shorthand property", `{ a }`],
    ["a computed key", `{ ["a"]: 1 }`],
    ["a spread in an object", `{ ...other }`],
    ["a spread in an array", `[...other]`],
    ["an arrow function", `{ a: () => 1 }`],
    ["new", `{ a: new Date() }`],
    ["NaN", `{ a: NaN }`],
    ["Infinity", `{ a: Infinity }`],
    ["a hex number", `{ a: 0x10 }`],
    ["a regular expression", `{ a: /x/ }`],
    ["an unterminated string", `{ a: "x }`],
    ["an array hole", `[1,,2]`],
    ["trailing code", `{ a: 1 } ; alert(1)`],
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

  it("names the line a refusal was found on", () => {
    expect(() => readBoundLiteral("const n = {\n  a: 1,\n  b: evil(),\n};", "n")).toThrow(/line 3/);
  });
});
