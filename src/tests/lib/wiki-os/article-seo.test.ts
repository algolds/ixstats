import { articleSeo, descriptionFromHtml, leadImageUrl } from "~/lib/wiki-os/article-seo";

describe("descriptionFromHtml (plan 412)", () => {
  it("is the first paragraph of real prose, without tags, entities or extra whitespace", () => {
    const html =
      '<p class="lead">Short.</p><p>The <b>Republic</b> of Aurelia &amp; its   colonies are\n a country of Eurth&#39;s northern coast.</p><p>Second paragraph, long enough to be prose too.</p>';
    expect(descriptionFromHtml(html)).toBe(
      "The Republic of Aurelia & its colonies are a country of Eurth's northern coast."
    );
  });

  it("is cut at a word boundary with an ellipsis", () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const description = descriptionFromHtml(`<p>${words}</p>`);

    expect(description?.length).toBeLessThanOrEqual(200);
    expect(description?.endsWith("…")).toBe(true);
    expect(description).not.toMatch(/word\d* …$/);
    expect(words.startsWith(description!.slice(0, -1))).toBe(true);
  });

  it("is null for a page with no paragraph of prose", () => {
    expect(descriptionFromHtml("<ul><li>A</li><li>B</li></ul>")).toBeNull();
    expect(descriptionFromHtml("<p>Too short.</p>")).toBeNull();
    expect(descriptionFromHtml("")).toBeNull();
  });

  it("does not take <pre> or <param> for a paragraph", () => {
    const html = "<pre>preformatted text that is long enough to count as a paragraph, surely</pre>";
    expect(descriptionFromHtml(html)).toBeNull();
  });

  it("stays linear on hostile markup: thousands of '<p ' and '<' with no closer", () => {
    const hostile = `<div title="${"<p ".repeat(15_000)}">x</div>`;
    const started = Date.now();
    expect(descriptionFromHtml(hostile)).toBeNull();
    descriptionFromHtml(`<p>${"<".repeat(50_000)}</p>`); // whatever it returns, it returns promptly
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("ignores text past the start of a very long page", () => {
    const filler = "<div>x</div>".repeat(10_000);
    expect(
      descriptionFromHtml(
        `${filler}<p>A long enough paragraph, but far down the page, so nobody looks.</p>`
      )
    ).toBeNull();
  });
});

describe("leadImageUrl and articleSeo (plan 412)", () => {
  it("makes a site-relative image absolute on the public origin and leaves an absolute one alone", () => {
    const html =
      '<table class="infobox"><tr><td><img src="https://cdn.example/a.png"></td></tr></table>';
    expect(leadImageUrl(html, "https://ixwiki.com")).toBe("https://cdn.example/a.png");
    expect(leadImageUrl("<p>none</p>", "https://ixwiki.com")).toBeNull();
  });

  it("reads the image from the infobox first, and the description from the body", () => {
    const seo = articleSeo(
      {
        contentHtml:
          "<p>Aurelia is a country of Eurth, known for its long coast and its fleets.</p>",
        infoboxHtml:
          '<table class="infobox"><tr><td><img src="https://cdn.example/flag.png" width="300" height="200"></td></tr></table>',
      },
      "https://ixwiki.com"
    );

    expect(seo.description).toMatch(/^Aurelia is a country/);
    expect(seo.image).toBe("https://cdn.example/flag.png");
  });
});
