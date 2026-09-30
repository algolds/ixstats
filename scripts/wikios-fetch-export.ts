/**
 * scripts/wikios-fetch-export.ts — build a MediaWiki XML dump from a live wiki's Action API (plan 408)
 *
 * Usage:
 *   bun scripts/wikios-fetch-export.ts --api https://ixwiki.com/api.php --out dump.xml \
 *     [--history] [--namespaces all|0,1,10]
 *
 * Read-only: GET requests only, at least one second apart, as `User-Agent: IxStats-Builder`.
 * Pages are listed per namespace (redirects included), then fetched 50 at a time with
 * `action=query&export=1&exportnowrap=1` (current revisions) or, with --history, revision by
 * revision with `prop=revisions` and continuation. The file is written through WikiOS's own export
 * writer; import it with scripts/wikios-import-xml.ts. A full wiki takes a long time at this pace:
 * on the wiki's own server `php maintenance/run.php dumpBackup` is much faster.
 */

import { createWriteStream } from "node:fs";

const USAGE =
  "Usage: bun scripts/wikios-fetch-export.ts --api <api.php URL> --out <file.xml> [--history] [--namespaces all|N,N...]";

interface CliArgs {
  api: string;
  out: string;
  history: boolean;
  namespaces: number[] | "all";
}

function parseNamespaces(value: string): number[] | "all" | null {
  if (value === "all") return "all";
  const ids = value.split(",").map((id) => Number(id.trim()));
  return ids.every((id) => Number.isInteger(id) && id >= 0) ? ids : null;
}

function parseArgs(argv: string[]): CliArgs | null {
  let api = "";
  let out = "";
  let history = false;
  let namespaces: number[] | "all" | null = "all";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--history") history = true;
    else if (arg === "--api") api = argv[++i] ?? "";
    else if (arg === "--out") out = argv[++i] ?? "";
    else if (arg === "--namespaces") namespaces = parseNamespaces(argv[++i] ?? "");
    else return null;
  }
  return api && out && namespaces ? { api, out, history, namespaces } : null;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    return 2;
  }

  const { fetchDump } = await import("../src/lib/wiki-os/xml/fetch-dump");
  const file = createWriteStream(args.out);
  const write = (chunk: string): Promise<void> =>
    new Promise((resolve, reject) => {
      file.write(chunk, (error) => (error ? reject(error) : resolve()));
    });

  console.error(
    `Fetching ${args.history ? "full history" : "current revisions"} from ${args.api}...`
  );
  const pages = await fetchDump({
    api: args.api,
    write,
    history: args.history,
    namespaces: args.namespaces,
    onProgress: (message) => console.error(`  ${message}`),
  });
  await new Promise<void>((resolve) => file.end(resolve));
  console.error(`Wrote ${pages} pages to ${args.out}.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: Error) => {
    console.error(`Fetch failed: ${error.message}`);
    process.exit(1);
  });
