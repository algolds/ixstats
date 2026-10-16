/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/styles/thinkpages-forum.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

describe("a forum post's stylesheet", () => {
  it("contains and isolates the post, so a member's fixed or absolute markup stays inside it", () => {
    const post = rule('[data-app="thinkpages"] .forum-post');
    expect(post).toMatch(/contain:\s*layout paint;/);
    expect(post).toMatch(/isolation:\s*isolate;/);
  });

  it("still floats the infobox inside the contained post", () => {
    expect(rule('[data-app="thinkpages"] .forum-post .forum-infobox')).toMatch(/float:\s*right;/);
  });

  it("styles a resolved mention as a tinted link in both post styles", () => {
    const mention = rule(
      '[data-app="thinkpages"] .forum-post a.forum-mention,\n  [data-app="thinkpages"] .forum-post a.forum-mention:visited'
    );
    expect(mention).toMatch(/color:\s*var\(--tint\);/);
    expect(mention).toMatch(/text-decoration:\s*none;/);
    expect(rule('[data-app="thinkpages"] .forum-post a.forum-mention:hover')).toMatch(
      /text-decoration:\s*underline;/
    );
  });

  it("sets in-character posts on the Facet prose scale, with no raw pixel font sizes", () => {
    const sel = (s: string) => rule(`[data-app="thinkpages"] .forum-post--ic${s}`);
    expect(sel("")).toMatch(/font-size:\s*calc\(1\.0625rem \* var\(--text-scale, 1\)\);/);
    expect(sel("")).toMatch(/line-height:\s*1\.6;/);
    expect(sel(" h2")).toMatch(/font-size:\s*calc\(1\.25rem \* var\(--text-scale, 1\)\);/);
    expect(sel(" h3")).toMatch(/font-size:\s*calc\(1\.0625rem \* var\(--text-scale, 1\)\);/);
    expect(sel(" h4")).toMatch(/font-size:\s*calc\(1\.0625rem \* var\(--text-scale, 1\)\);/);
    expect(rule('[data-app="thinkpages"] .forum-post .forum-infobox')).toMatch(
      /font-size:\s*calc\(0\.8125rem \* var\(--text-scale, 1\)\);/
    );
    for (const s of ["", " h2", " h3", " h4"]) expect(sel(s)).not.toMatch(/font-size:\s*[\d.]+px/);
  });

  it("sets the quote author on the Facet scale, not in raw pixels", () => {
    expect(rule('[data-app="thinkpages"] .forum-post .forum-quote-author')).toMatch(
      /font-size:\s*calc\(0\.8125rem \* var\(--text-scale, 1\)\);/
    );
  });
});
