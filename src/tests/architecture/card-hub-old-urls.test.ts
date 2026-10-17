/** @jest-environment node */
/**
 * Cards refresh Phase 3 (spec §2.3 Hub): every old card address answers with a redirect from `src/proxy.ts`, so no
 * page may come back at one, and no link, doc or help page sends a reader to one. Only the redirect table names them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { cardHubIndexRedirectFor, legacyCardRedirectFor } from "~/lib/cards/hub-routes";

const ROOT = resolve(__dirname, "../../..");
const APP = join(ROOT, "src/app");

// `/help/vault/trading` is a help page, not a card address.
const OLD =
  /(?<!\/help)\/vault\/(inventory|collections|lore-gallery|ns-library|ns-deck|packs|market\b|marketplace|trading|crafting|lore-generator)\b|\/explore\/collections|\/vault\/store\?tab=/;
const ROOTS = ["src", "docs/systems", "public", "README.md"];
const ALLOWED = new Set(["src/lib/cards/hub-routes.ts"]);

function walk(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return entry.name === "tests" ? [] : walk(child);
    return /\.(tsx?|[cm]?js|json|md|html)$/.test(entry.name) ? [child] : [];
  });
}

/** A page's or route handler's address: route groups and parallel slots add no segment. */
function addressOf(file: string): string {
  const segments = relative(APP, dirname(file))
    .split(sep)
    .filter((segment) => segment && !/^\(.*\)$/.test(segment) && !segment.startsWith("@"));
  return `/${segments.join("/")}`;
}

const addresses = walk(APP)
  .filter((file) => /^(page|route)\.(tsx?|jsx?|mdx)$/.test(basename(file)))
  .map(addressOf);

describe("old card addresses", () => {
  it("finds the hub's own pages", () => {
    expect(addresses).toEqual(expect.arrayContaining(["/vault/cards/mine", "/vault/store"]));
  });

  it("have no page or route handler; the proxy answers them", () => {
    const shadowed = addresses.filter(
      (address) => legacyCardRedirectFor(address, "") ?? cardHubIndexRedirectFor(address, "")
    );
    expect(shadowed).toEqual([]);
  });

  it("appear nowhere but the redirect table", () => {
    const offenders = ROOTS.flatMap((root) => walk(join(ROOT, root)))
      .map((file) => relative(ROOT, file))
      .filter((file) => !ALLOWED.has(file))
      .flatMap((file) =>
        readFileSync(join(ROOT, file), "utf8")
          .split("\n")
          .flatMap((line, index) => (OLD.test(line) ? [`${file}:${index + 1}`] : []))
      );
    expect(offenders).toEqual([]);
  });
});
