/** @jest-environment node */
/**
 * Every special page WikiOS answers with a redirect lands on a `/util` route that exists: the rendered-link rule
 * (html-links.ts, B4a) keeps those links in-app, so a missing route would be a WikiOS 404. Dynamic folders (`[user]`,
 * `[slug]`) stand for one path segment.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  ADMIN_SPECIALS,
  resolveWikiPath,
  SPECIAL_TOOLS,
  type SpecialAction,
} from "~/lib/wiki-os/wiki-path";

const APP = path.join(process.cwd(), "src/app/(wiki-os)");
const ONE_SEGMENT_FOLDER = /^\[[^.\]]+\]$/u;

/** The folder under `dir` that serves the URL segment `segment`: its own, else a one-segment dynamic one. */
function folderFor(dir: string, segment: string): string | null {
  if (existsSync(path.join(dir, segment))) return path.join(dir, segment);
  const dynamic = readdirSync(dir).find((name) => ONE_SEGMENT_FOLDER.test(name));
  return dynamic ? path.join(dir, dynamic) : null;
}

/** Whether `href` (`/util/...?query`) names a page of the WikiOS app. */
function routeExists(href: string): boolean {
  const [pathname = ""] = href.split(/[?#]/u);
  let dir: string | null = APP;
  for (const segment of pathname.split("/").filter(Boolean)) {
    dir = dir && folderFor(dir, segment);
  }
  return dir !== null && existsSync(path.join(dir, "page.tsx"));
}

function hrefOf(action: SpecialAction): string {
  if (action.type !== "redirect") throw new Error(`not a redirect: ${action.type}`);
  return action.href;
}

describe("special pages land on existing /util routes", () => {
  it.each(Object.entries(SPECIAL_TOOLS))("Special:%s goes to %s", (_key, href) => {
    expect(routeExists(href)).toBe(true);
  });

  it.each(Object.keys(ADMIN_SPECIALS))("Special:%s, bare and with a target", (key) => {
    const handler = ADMIN_SPECIALS[key]!;
    expect(routeExists(hrefOf(handler("", {})))).toBe(true);
    expect(routeExists(hrefOf(handler("Foo", {})))).toBe(true);
  });

  it.each([
    "Special:",
    "Special:Contributions",
    "Special:Contributions/Ada_Lovelace",
    "Special:WhatLinksHere",
    "Special:WhatLinksHere/Gallambria",
    "Special:WhatLinksHere/A/B",
    "Special:Diff/12",
    "Special:Diff/12/13",
    "Special:Search",
    "Special:Search/Rome",
    "Special:Log",
    "Special:Log/move",
  ])("%s", (name) => {
    const target = resolveWikiPath(name.split("/"));
    if (target.kind !== "special") throw new Error(`${name} is not a special page`);
    expect(routeExists(hrefOf(target.action))).toBe(true);
  });

  it("the walk refuses a route that does not exist", () => {
    expect(routeExists("/util/no-such-tool")).toBe(false);
    expect(routeExists("/util/recent-changes/extra")).toBe(false);
  });
});

describe("namespaces of Special:AllPages and Special:PrefixIndex", () => {
  const actionOf = (name: string, query: Record<string, string>) => {
    const target = resolveWikiPath([name], new URLSearchParams(query));
    return target.kind === "special" ? target.action : null;
  };

  it.each(["Special:AllPages", "Special:PrefixIndex"])(
    "%s takes a namespace up to listPages' 32767 cap",
    (name) => {
      expect(actionOf(name, { namespace: "32767" })).toMatchObject({
        type: "list-pages",
        namespace: 32767,
      });
      expect(actionOf(name, { namespace: "460" })).toMatchObject({ namespace: 460 });
    }
  );

  it.each(["Special:AllPages", "Special:PrefixIndex"])(
    "%s with a namespace past the cap is unknown, so its link stays on IxWiki",
    (name) => {
      expect(actionOf(name, { namespace: "32768" })).toEqual({ type: "unknown" });
      expect(actionOf(name, { namespace: "99999" })).toEqual({ type: "unknown" });
    }
  );

  it("a namespace that is not a number keeps the default", () => {
    expect(actionOf("Special:AllPages", { namespace: "abc" })).toMatchObject({ namespace: 0 });
  });
});
