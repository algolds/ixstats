/**
 * Jest globalSetup: Prisma 7's client ships a slim `Prisma.dmmf` (names and types only), so the full datamodel the
 * in-memory client and the schema-default tests read (ids, uniques, defaults, relations) is computed from the schema
 * once per run and cached at DMMF_CACHE.
 */
import fs from "node:fs";
import path from "node:path";
import { getDMMF } from "@prisma/internals";
import { DMMF_CACHE } from "./dmmf-cache";

export default async function writeFullDmmf(): Promise<void> {
  const dir = path.resolve("prisma/schema");
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".prisma"))
    .map((name): [string, string] => [
      path.join(dir, name),
      fs.readFileSync(path.join(dir, name), "utf8"),
    ]);
  const dmmf = await getDMMF({ datamodel: files });
  fs.mkdirSync(path.dirname(DMMF_CACHE), { recursive: true });
  fs.writeFileSync(DMMF_CACHE, JSON.stringify(dmmf.datamodel));
}
