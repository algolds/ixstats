import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  filterHelpSections,
  helpSections,
  retiredHelpArticles,
} from "~/app/help/_lib/help-sections";
import { parseMarkdownDocument } from "~/lib/markdown-document";

const ROOT = path.resolve(__dirname, "../../..");
const HELP = path.join(ROOT, "src/content/help");
const APP = path.join(ROOT, "src/app");

const articleFiles = readdirSync(HELP).flatMap((folder) =>
  readdirSync(path.join(HELP, folder))
    .filter((file) => file.endsWith(".md"))
    .map((file) => `${folder}/${file.replace(/\.md$/, "")}`)
);
const registered = helpSections.flatMap((section) => section.articles);
const source = (article: string) => readFileSync(path.join(HELP, `${article}.md`), "utf8");

/** Every page route under src/app as a regex (route groups dropped, dynamic segments as wildcards). */
function appRoutes(): RegExp[] {
  const routes: RegExp[] = [];
  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry.startsWith("_") || entry === "api") continue;
        walk(full, [...segments, entry]);
      } else if (entry === "page.tsx") {
        const parts = segments
          .filter((s) => !/^\(.*\)$/.test(s))
          .map((s) => {
            if (/^\[\[\.\.\..+\]\]$/.test(s)) return "(?:/.+)?";
            if (/^\[\.\.\..+\]$/.test(s)) return "/.+";
            if (/^\[.+\]$/.test(s)) return "/[^/]+";
            return `/${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
          });
        routes.push(new RegExp(`^${parts.join("") || "/"}$`));
      }
    }
  };
  walk(APP, []);
  return routes;
}

const ROUTES = appRoutes();

/** Internal links in an article: markdown links plus frontmatter prev/next. */
function internalLinks(article: string): string[] {
  const text = source(article);
  const { meta } = parseMarkdownDocument(text);
  const inline = [...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1] ?? "");
  return [...inline, meta.prevHref, meta.nextHref].filter((l): l is string => !!l);
}

describe("help center registry", () => {
  it("has unique section and article ids", () => {
    const sectionIds = helpSections.map((s) => s.id);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    const articleIds = registered.map((a) => a.id);
    expect(new Set(articleIds).size).toBe(articleIds.length);
  });

  it("lists every article file exactly once", () => {
    const paths = registered.map((a) => a.path.replace(/^\/help\//, ""));
    expect(new Set(paths).size).toBe(paths.length);
    expect([...paths].sort()).toEqual([...articleFiles].sort());
  });

  it("starts with the Start Here section and its welcome article", () => {
    expect(helpSections[0]?.id).toBe("getting-started");
    expect(helpSections[0]?.articles[0]?.path).toBe("/help/getting-started/welcome");
  });

  it("keeps registry titles in step with article frontmatter", () => {
    for (const article of registered) {
      const { meta } = parseMarkdownDocument(source(article.path.replace(/^\/help\//, "")));
      expect({ path: article.path, title: meta.title }).toEqual({
        path: article.path,
        title: article.title,
      });
    }
  });

  it("redirects retired articles to articles that exist", () => {
    for (const [retired, target] of Object.entries(retiredHelpArticles)) {
      expect(existsSync(path.join(HELP, `${retired}.md`))).toBe(false);
      expect(articleFiles).toContain(target.replace(/^\/help\//, ""));
    }
  });
});

describe("help article links", () => {
  it.each(articleFiles)("%s links only to routes and articles that exist", (article) => {
    for (const link of internalLinks(article)) {
      const [pathPart = "", hash] = link.split("#");
      const route = pathPart.split("?")[0] ?? "";
      if (route.startsWith("/help/")) {
        const target = route.replace(/^\/help\//, "");
        expect({ link, retired: target in retiredHelpArticles }).toEqual({ link, retired: false });
        expect({ link, exists: articleFiles.includes(target) }).toEqual({ link, exists: true });
        if (hash) {
          const ids = parseMarkdownDocument(source(target)).headings.map((h) => h.id);
          expect({ link, anchor: ids.includes(hash) }).toEqual({ link, anchor: true });
        }
      } else if (route === "") {
        // Same-page anchor: the heading must exist in this article.
        const ids = parseMarkdownDocument(source(article)).headings.map((h) => h.id);
        expect({ link, anchor: ids.includes(hash ?? "") }).toEqual({ link, anchor: true });
      } else {
        expect({ link, routed: ROUTES.some((r) => r.test(route)) }).toEqual({
          link,
          routed: true,
        });
      }
    }
  });
});

describe("forum naming (U3, U4)", () => {
  it("links the forum article under its own title, never as The Forum", () => {
    for (const article of articleFiles) {
      for (const [, label] of source(article).matchAll(/\[([^\]]*)\]\(\/help\/social\/forum\)/g)) {
        expect({ article, label }).not.toEqual({ article, label: "The Forum" });
      }
    }
  });

  it("tells signed-out readers how to reach the forum, not only the signed-in sidebar", () => {
    const forum = source("social/forum");
    expect(forum).not.toContain("In the sidebar it is **ThinkPages** under Home.");
    expect(forum).toContain("signed out, open it at [/thinkpages](/thinkpages)");
  });
});

describe("filterHelpSections", () => {
  it("returns every section for an empty query and 'all'", () => {
    expect(filterHelpSections(helpSections, "", "all")).toHaveLength(helpSections.length);
  });

  it("scopes to one section", () => {
    const result = filterHelpSections(helpSections, "", "vault");
    expect(result.map((s) => s.id)).toEqual(["vault"]);
  });

  it("matches titles, descriptions and tags case-insensitively", () => {
    const hits = filterHelpSections(helpSections, "DAILY REWARD", "all").flatMap((s) =>
      s.articles.map((a) => a.path)
    );
    expect(hits).toContain("/help/vault/ixcredits");
  });

  it("keeps a whole section when its title matches", () => {
    const result = filterHelpSections(helpSections, "diplomacy", "all");
    const diplomacy = result.find((s) => s.id === "diplomacy");
    const original = helpSections.find((s) => s.id === "diplomacy");
    expect(diplomacy?.articles).toHaveLength(original?.articles.length ?? -1);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterHelpSections(helpSections, "zzzz-no-such-topic", "all")).toEqual([]);
  });
});
