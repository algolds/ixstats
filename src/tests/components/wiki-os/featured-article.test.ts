/**
 * Plan 404 review: extractFeaturedArticle and transformFeaturedContent counted `</div>`s and cut
 * `<div ...>[\s\S]*?</div>` by regex on sanitized Main Page HTML. A byline whose attribute held
 * `</div>` ended the cut inside the attribute and published the rest as markup (the card goes into
 * the hero's dangerouslySetInnerHTML). They work on the DOM now, and the result is sanitized again.
 */
import { extractFeaturedArticle } from "~/components/wiki-os/reader/featured-article";

function mount(html: string | null): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html ?? "";
  return container;
}

function expectInert(container: HTMLElement) {
  expect(container.querySelectorAll("img")).toHaveLength(0);
  expect(container.querySelectorAll("[onerror]")).toHaveLength(0);
  expect(container.querySelectorAll("script")).toHaveLength(0);
}

const PAYLOAD = '<span title="</div><img src=x onerror=alert(1)>">y</span>';

describe("extractFeaturedArticle", () => {
  it("cuts out the card by its id and dresses it for the hero", () => {
    const html =
      '<div id="intro"><p>Welcome</p></div>' +
      '<div id="featured_article" class="card"><div class="card-image"><img src="https://ixwiki.com/images/a.png"></div>' +
      '<div class="card-text"><p>Featured article</p><h3><a href="https://ixwiki.com/wiki/Aurelia">Aurelia</a></h3>' +
      '<p>A country on <a href="/w/Special:MyLanguage/Eurth">Eurth</a>.</p>' +
      '<div class="byline">by <b>Someone</b><div>nested</div></div></div></div>' +
      '<div id="after"><p>After</p></div>';

    const card = mount(extractFeaturedArticle(html));

    expect(card.querySelector(".wikios-fa-card")).not.toBeNull();
    expect(card.querySelector(".wikios-fa-image img")).not.toBeNull();
    expect(card.querySelector(".wikios-fa-text")).not.toBeNull();
    expect(card.querySelector("h3 a")?.getAttribute("href")).toBe("/wiki/Aurelia");
    expect(card.querySelector("p a")?.getAttribute("href")).toBe("/wiki/Eurth");
    expect(card.textContent).toContain("A country on Eurth.");
    expect(card.textContent).not.toContain("Featured article");
    expect(card.textContent).not.toContain("Someone");
    expect(card.textContent).not.toContain("nested");
    expect(card.textContent).not.toContain("Welcome");
    expect(card.textContent).not.toContain("After");
  });

  it("does not let a byline's attribute end the cut early (the reviewer's payload)", () => {
    const html =
      '<div id="featured_article" class="card"><div class="byline">by ' +
      PAYLOAD +
      "</div><p>Body text</p></div>";

    const card = mount(extractFeaturedArticle(html));

    expectInert(card);
    expect(card.textContent).toContain("Body text");
    expect(card.textContent).not.toContain("by y");
  });

  it("does not let a payload in the card cut the card short when counting its end", () => {
    const html =
      '<div id="featured_article"><p>Lead ' +
      PAYLOAD +
      '</p></div><div id="rest"><img src=x onerror=alert(2)><script>alert(3)</script></div>';

    const card = mount(extractFeaturedArticle(html));

    expectInert(card);
    expect(card.textContent).toContain("Lead");
    expect(card.textContent).not.toContain("alert");
  });

  it("does not let a payload in a p byline or a card-byline either", () => {
    const html =
      '<div class="card"><p class="byline">' +
      PAYLOAD +
      '</p><div class="card-byline">' +
      PAYLOAD +
      "</div><p>Kept</p></div>";

    const card = mount(extractFeaturedArticle(html));

    expectInert(card);
    expect(card.textContent).toBe("Kept");
  });

  it("sanitizes what it returns: script, handlers and javascript: links never reach the hero", () => {
    const html =
      '<div id="mp-tfa"><p onclick="steal()">Hi <a href="javascript:alert(1)">link</a></p><script>alert(2)</script><img src=x onerror="alert(3)"></div>';

    const out = extractFeaturedArticle(html)!;

    expect(out).not.toMatch(/<script|onclick|onerror|javascript:/i);
    expect(out).toContain("Hi");
  });

  it.each([
    ['div[id="mp-tfa"]', '<div id="mp-tfa"><p>tfa</p></div>'],
    ['div[id="mainpage-featured"]', '<div id="mainpage-featured"><p>mainpage</p></div>'],
    ["div.tfa-box", '<div class="x tfa-box y"><p>box</p></div>'],
    ["section.featured", '<section class="mp featured-thing"><p>section</p></section>'],
    ["div.card", '<div class="card"><p>card</p></div>'],
  ])("finds the card by %s", (_name, card) => {
    const out = extractFeaturedArticle(`<div><p>other</p></div>${card}`);

    expect(mount(out).textContent).toBe(mount(card).textContent);
  });

  it("prefers the more specific card to a generic one", () => {
    const out = extractFeaturedArticle(
      '<div class="card"><p>generic</p></div><div id="featured_article"><p>specific</p></div>'
    );

    expect(mount(out).textContent).toBe("specific");
  });

  it("takes a short page with a paragraph in it to be the card itself, and nothing else to be none", () => {
    expect(mount(extractFeaturedArticle("<p>Short page</p>")).textContent).toBe("Short page");
    expect(extractFeaturedArticle(`<div>${"word ".repeat(600)}<p>long</p></div>`)).toBeNull();
    expect(extractFeaturedArticle("<div>no paragraphs</div>")).toBeNull();
    expect(extractFeaturedArticle("")).toBeNull();
  });
});
