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
});
