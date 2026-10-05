import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

/** Keys declared in the server/client/runtimeEnv blocks of src/env.ts. */
function envSchemaKeys(): string[] {
  const keys = new Set<string>();
  for (const match of read("src/env.ts").matchAll(/^\s{4}([A-Z][A-Z0-9_]+):/gm))
    keys.add(match[1]!);
  return [...keys];
}

/** Keys in .env.example, set or commented out (`# KEY=`). */
function exampleKeys(): Set<string> {
  return new Set(
    [...read(".env.example").matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]!)
  );
}

describe(".env.example", () => {
  it("lists every variable src/env.ts declares", () => {
    const documented = exampleKeys();
    expect(envSchemaKeys().filter((key) => !documented.has(key))).toEqual([]);
  });

  it("includes the secret production refuses to boot without", () => {
    expect(read(".env.example")).toMatch(/^WIKI_SYNC_WEBHOOK_SECRET=/m);
  });
});
