import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { headingAnchor, parseMarkdownDocument, slugify } from "~/lib/markdown-document";

const ROOT = path.resolve(__dirname, "../../..");
const CONTENT = path.join(ROOT, "src/content");

const DOCUMENTS = [
  "legal/terms.md",
  "legal/privacy.md",
  ...readdirSync(path.join(CONTENT, "help")).flatMap((category) =>
    readdirSync(path.join(CONTENT, "help", category)).map((file) => `help/${category}/${file}`)
  ),
];

/** Section anchors of the legal pages before the markdown conversion; external links may use them. */
const LEGAL_ANCHORS: Record<string, string[]> = {
  "legal/terms.md": [
    "acceptance-eligibility",
    "intellectual-property",
    "third-party-services",
    "acceptable-use",
    "virtual-assets-disclaimers",
    "termination-governing-law",
  ],
  "legal/privacy.md": [
    "data-collected",
    "how-we-use-data",
    "subprocessors-storage",
    "cookies-local-storage",
    "user-rights-erasure",
    "security-contact",
  ],
};

const source = (file: string) => readFileSync(path.join(CONTENT, file), "utf8");
const renderedIds = (html: string, level: string) =>
  [...html.matchAll(new RegExp(`<h${level} id="([^"]+)"`, "g"))].map((match) => match[1]);

let rendered: string[] = [];

beforeAll(() => {
  rendered = execFileSync("bun", ["src/tests/content/render-documents.tsx", ...DOCUMENTS], {
    cwd: ROOT,
    encoding: "utf8",
  }).split("\0");
}, 60_000);

const htmlOf = (file: string) => rendered[DOCUMENTS.indexOf(file)] ?? "";

describe("markdown documents", () => {
  it("finds the legal pages and every help article", () => {
    expect(DOCUMENTS.length).toBeGreaterThanOrEqual(56);
    expect(rendered).toHaveLength(DOCUMENTS.length);
  });

  it.each(DOCUMENTS)("%s renders its headings with the expected ids", (file) => {
    const { headings } = parseMarkdownDocument(source(file));
    const html = htmlOf(file);
    const h2 = headings.filter((heading) => heading.depth === 2).map((heading) => heading.id);
    const h3 = headings.filter((heading) => heading.depth === 3).map((heading) => heading.id);

    expect(h2.length).toBeGreaterThan(0);
    expect(renderedIds(html, "2")).toEqual(h2);
    expect(renderedIds(html, "3")).toEqual(h3);
    expect(new Set([...h2, ...h3]).size).toBe(h2.length + h3.length);
    expect(html).not.toMatch(/\{#|\[!WARNING\]/);
  });

  it.each(Object.entries(LEGAL_ANCHORS))("%s keeps its section anchors", (file, anchors) => {
    const { headings } = parseMarkdownDocument(source(file));
    expect(headings.filter((heading) => heading.depth === 2).map((h) => h.id)).toEqual(anchors);
    expect(renderedIds(htmlOf(file), "2")).toEqual(anchors);
  });

  it.each(DOCUMENTS)("%s has a title, description and badge", (file) => {
    const { meta } = parseMarkdownDocument(source(file));
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect(meta.badge).toBeTruthy();
  });

  it("renders one warning callout per [!WARNING] marker and the rest as notes", () => {
    const all = DOCUMENTS.map(source).join("\n");
    const html = rendered.join("\n");
    const markers = all.match(/^> \[!WARNING\]$/gm)?.length ?? 0;
    expect(markers).toBeGreaterThan(0);
    expect(html.match(/data-callout="warning"/g)?.length).toBe(markers);
    expect(html.match(/<aside/g)?.length).toBe(all.match(/\n\n> /g)?.length);
  });

  it("links only to help articles that exist", () => {
    const links = DOCUMENTS.flatMap((file) => [
      ...source(file).matchAll(/\]\((\/help\/[a-z0-9-]+\/[a-z0-9-]+)\)/g),
    ]).map((match) => `${match[1]}.md`);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(DOCUMENTS).toContain(link.slice(1));
  });
});

describe("heading anchors", () => {
  it("uses a pinned {#id} and strips it from the title", () => {
    expect(headingAnchor("1. Operator, Scope & Eligibility {#acceptance-eligibility}")).toEqual({
      title: "1. Operator, Scope & Eligibility",
      id: "acceptance-eligibility",
    });
  });

  it("slugs headings without a pinned id", () => {
    expect(headingAnchor("GDP: The Big Number")).toEqual({
      title: "GDP: The Big Number",
      id: "gdp-the-big-number",
    });
    expect(slugify("  Taxes & Revenue -- 2026 ")).toBe("taxes-revenue-2026");
  });

  it("parses frontmatter separately from the body", () => {
    const doc = parseMarkdownDocument(
      "---\ntitle: A: B\nbadge: C\n---\n\nText\n\n## One\n\n### Two {#two}\n"
    );
    expect(doc.meta).toEqual({ title: "A: B", badge: "C" });
    expect(doc.body.startsWith("\nText")).toBe(true);
    expect(doc.headings).toEqual([
      { depth: 2, title: "One", id: "one" },
      { depth: 3, title: "Two", id: "two" },
    ]);
  });
});
