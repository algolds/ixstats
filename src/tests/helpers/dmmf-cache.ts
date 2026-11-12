import fs from "node:fs";
import path from "node:path";
import type { getDMMF } from "@prisma/internals";

type Datamodel = Awaited<ReturnType<typeof getDMMF>>["datamodel"];

/** Where dmmf-global-setup.ts writes the full datamodel for this run. */
export const DMMF_CACHE = path.resolve("node_modules/.cache/ixstats-tests/dmmf.json");

/** The schema's full datamodel (Prisma 7's runtime `Prisma.dmmf` lacks ids, uniques, defaults and relations). */
export function fullDatamodel(): Datamodel {
  return JSON.parse(fs.readFileSync(DMMF_CACHE, "utf8")) as Datamodel;
}
