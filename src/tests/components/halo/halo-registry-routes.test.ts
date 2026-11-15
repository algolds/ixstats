/** @jest-environment node */
/**
 * Every palette and nav-tray destination must resolve to a real page, and the palette must not repeat one.
 * Route patterns come from walking `src/app` for `page.tsx` files, the way Next.js builds its routes.
 */
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CORE_COMMANDS, CORE_FEATURES } from "~/components/halo/halo-registry";
import { PRIMARY_NAV, SECONDARY_NAV } from "~/components/halo/views/NavTray";

// NavTray pulls in pretext, an ESM-only package Jest cannot parse. The routes do not depend on its text layout.
jest.mock("~/components/ui/pretext", () => ({ PreText: () => null }));

const APP_DIR = join(__dirname, "..", "..", "..", "app");

function pageDirectories(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return pageDirectories(full);
    return entry.name === "page.tsx" ? [relative(APP_DIR, dir)] : [];
  });
}

const isRouteGroup = (segment: string) => /^\(.*\)$/.test(segment);
const isParallelSlot = (segment: string) => segment.startsWith("@");

function segmentPattern(segment: string): string {
  if (segment.startsWith("[[...")) return "(?:/.*)?";
  if (segment.startsWith("[...")) return "/.+";
  if (segment.startsWith("[")) return "/[^/]+";
  return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
}

function routeMatchers(): RegExp[] {
  return pageDirectories(APP_DIR).map((dir) => {
    const segments = dir
      .split(sep)
      .filter(Boolean)
      .filter((segment) => !isRouteGroup(segment) && !isParallelSlot(segment));
    const pattern = segments.map(segmentPattern).join("") || "/";
    return new RegExp(`^${pattern}/?$`);
  });
}

const matchers = routeMatchers();
const resolves = (path: string) => matchers.some((matcher) => matcher.test(path));

/** Internal actions (`#...`) and external links have no page to check. */
const routedPaths = (paths: (string | undefined)[]) =>
  paths.filter((path): path is string => Boolean(path) && !/^(#|http)/.test(path ?? ""));

const paletteRaw = [...CORE_COMMANDS, ...CORE_FEATURES].map((entry) => entry.path);
const navRaw = [...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => item.href);

describe("halo registry and nav tray routes", () => {
  it("points every palette and nav entry at a page that exists", () => {
    const unresolved = routedPaths([...paletteRaw, ...navRaw]).filter(
      (path) => !resolves(path.split("?")[0] ?? path)
    );
    expect(unresolved).toEqual([]);
  });

  it("does not send the palette to /wiki/new, which the article catch-all would accept", () => {
    expect(paletteRaw).not.toContain("/wiki/new");
  });

  it("lists each destination once, so the palette never offers two entries for one page", () => {
    const paths = routedPaths(paletteRaw);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
