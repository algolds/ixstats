/** @jest-environment node */
/**
 * P1-33: `cron-runner.mjs` exits on an unknown name in CRON_ENABLED_JOBS, so every job name a deploy runbook tells the
 * owner to enable must exist in src/server/cron/jobs.ts: each `CRON_ENABLED_JOBS="…"` line and the job table of the
 * MyCountry runbook, and the enable order (the arrow lists) of the rose-garden runbook's step 7.
 */
import fs from "fs";
import path from "path";
import { CRON_JOBS, resolveEnabledJobs } from "~/server/cron/jobs";

const OPS = path.resolve(__dirname, "../../../docs/operations");
const read = (file: string) => fs.readFileSync(path.join(OPS, file), "utf8");

const backticked = (text: string) =>
  [...text.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)].map((m) => m[1]!);

function myCountryNames(): string[] {
  const doc = read("deploy-mycountry-2026-10.md");
  const lists = [...doc.matchAll(/CRON_ENABLED_JOBS="([^"]*)"/g)].flatMap((m) => m[1]!.split(","));
  const table = doc
    .split("\n")
    .filter((line) => /^\| `[a-z-]+` \|/.test(line))
    .flatMap((line) => backticked(line.split("|")[1]!));
  return [...lists, ...table].map((name) => name.trim()).filter(Boolean);
}

function roseGardenNames(): string[] {
  const doc = read("deploy-rose-garden-2026-09.md");
  const step7 = doc.slice(doc.indexOf("## 7."), doc.indexOf("## 8."));
  return step7
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.includes("→"))
    .flatMap(backticked);
}

describe("job names in the deploy runbooks", () => {
  it.each([
    ["deploy-mycountry-2026-10.md", myCountryNames],
    ["deploy-rose-garden-2026-09.md step 7", roseGardenNames],
  ])("%s names only jobs that exist", (_doc, names) => {
    const listed = names();
    expect(listed.length).toBeGreaterThan(5);
    expect(resolveEnabledJobs(listed.join(","), CRON_JOBS).unknown).toEqual([]);
  });
});
