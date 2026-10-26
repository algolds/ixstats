/** @jest-environment node */
import {
  stripClassTokens,
  stripPositioning,
  stripStyleDeclarations,
} from "~/lib/thinkpages-forum/strip-positioning";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";

describe("stripStyleDeclarations", () => {
  it.each([
    ["position:fixed;inset:0;z-index:99999;color:red", "color:red"],
    ["POSITION : Absolute ; top:0; left:0; right:0; bottom:0; width:10px", "width:10px"],
    ["transform:translate(-50%,-50%);translate:10px;scale:3;rotate:4deg;color:blue", "color:blue"],
    ["color:red;/* position:fixed */font-weight:bold", "color:red;font-weight:bold"],
  ])("removes overlay properties from %s", (input, expected) => {
    expect(stripStyleDeclarations(input)).toBe(expected);
  });

  it("drops the whole style when a property name uses a CSS escape", () => {
    expect(stripStyleDeclarations("p\\6fsition:fixed;color:red")).toBe("");
    expect(stripStyleDeclarations("\\70osition: fixed")).toBe("");
  });

  describe("styles the declaration tokenizer cannot read reliably are dropped whole", () => {
    it.each([
      [
        "a backslash outside quotes ending a declaration early",
        'a:\\";position:\\66ixed;inset:0;z-index:9999',
      ],
      ["a string a newline ends", 'a:"x\n;position:\\66ixed;top:0'],
      ["an escaped value (short form)", "position:\\66ixed;color:red"],
      ["an unterminated string", 'font-family:"abc;position:fixed'],
    ])("%s", (_name, input) => {
      expect(stripStyleDeclarations(input)).toBe("");
    });

    it.each([
      [
        "a double quote inside an unquoted url()",
        'a:url(x"y);position:absolute;inset:0;z-index:9999;b:")',
      ],
    ])("%s", (_name, input) => {
      expect(stripStyleDeclarations(input)).toBe("");
    });

    it("keeps ordinary url() backgrounds, quoted or not", () => {
      for (const style of [
        "background:url(https://ixwiki.com/images/x.png) no-repeat;width:22em",
        'background:url("https://ixwiki.com/images/a;b.png");width:22em',
        "background:url( 'a.png' ) center;width:22em",
        "background:url(a;b.png);width:22em",
        "background:image-set(url(a.png) 1x, url(b.png) 2x)",
      ]) {
        expect(stripStyleDeclarations(style)).toBe(style);
      }
    });
  });
  it("treats an unterminated comment as swallowing the rest", () => {
    expect(stripStyleDeclarations("color:red;/* position:fixed")).toBe("color:red");
  });
});

describe("stripClassTokens", () => {
  it.each([
    ["fixed inset-0 z-50", ""],
    ["md:fixed hover:absolute !fixed sm:-z-10 max-md:inset-0", ""],
    ["[position:fixed] z-[9999] top-[10px] inset-(--x)", ""],
    ["fixed inset-0 z-backdrop bg-scrim", "bg-scrim"],
    ["z-toast md:z-sheet keep", "keep"],
    [
      "wikitable infobox mw-parser-output infobox-header navbox floatright",
      "wikitable infobox mw-parser-output infobox-header navbox floatright",
    ],
    ["fixed-width left-hand wikitable", "fixed-width left-hand wikitable"],
  ])("filters %s", (input, expected) => {
    expect(stripClassTokens(input)).toBe(expected);
  });
});

describe("stripPositioning", () => {
  it("cleans style and class on any tag, nested", () => {
    const html =
      '<div class="fixed inset-0 z-50 keep" style="position:fixed;inset:0;z-index:99999"><p style="color:red;position:absolute">Please sign in again</p></div>';
    expect(stripPositioning(html)).toBe(
      '<div class="keep"><p style="color:red">Please sign in again</p></div>'
    );
  });
  it("is not fooled by > inside another attribute's value", () => {
    expect(
      stripPositioning(
        '<a title="a > b" style="position:fixed;color:red" href="/x?a=1&amp;b=2">t</a>'
      )
    ).toBe('<a title="a > b" style="color:red" href="/x?a=1&amp;b=2">t</a>');
  });
  it("drops a style or class token that hides characters in other entities", () => {
    expect(stripPositioning('<p style="position&colon;fixed">x</p>')).toBe("<p>x</p>");
    expect(stripPositioning('<p style="color:red" class="a&#102;ixed b">x</p>')).toBe(
      '<p style="color:red" class="b">x</p>'
    );
  });

  it.each(["a:\\&quot;;position:\\66ixed;inset:0;z-index:9999"])(
    "removes the style attribute that holds %j",
    (style) => {
      expect(stripPositioning(`<div class="keep" style="${style}">Please sign in</div>`)).toBe(
        '<div class="keep">Please sign in</div>'
      );
    }
  );

  it.each(["a:url(x&quot;y);position:absolute;inset:0;z-index:9999;b:&quot;)"])(
    "removes the style attribute that hides a declaration behind a bad url: %j",
    (style) => {
      expect(stripPositioning(`<div class="keep" style="${style}">x</div>`)).toBe(
        '<div class="keep">x</div>'
      );
    }
  );

  describe("characters CSS does not count as whitespace", () => {
    const SPACES: ReadonlyArray<readonly [string, string]> = [
      ["U+2003 em space", "\u2003"],
      ["U+200B zero width space", "\u200B"],
    ];

    it.each(SPACES)(
      "removes a style whose bad url hides declarations behind %s",
      (_name, space) => {
        const style = `a:url(${space}&quot;y);position:absolute;inset:0;z-index:9999;b:&quot;)`;
        expect(stripPositioning(`<div class="keep" style="${style}">x</div>`)).toBe(
          '<div class="keep">x</div>'
        );
      }
    );

    it.each(SPACES)("removes any style that holds %s", (_name, space) => {
      expect(stripPositioning(`<p style="color:red;${space}width:1px">x</p>`)).toBe("<p>x</p>");
    });

    it("keeps the whitespace CSS does count and non-ASCII letters", () => {
      const html =
        '<p style="font-family:Noto Sans JP, \u30e1\u30a4\u30ea\u30aa;\tcolor:red;\nwidth:1px;\r\nmargin:0">x</p>';
      expect(stripPositioning(html)).toBe(html);
    });
  });
  it("leaves a real-looking infobox and table intact", () => {
    const html =
      '<div class="mw-parser-output"><div class="forum-infobox"><table class="infobox infobox-country" style="width:22em;float:right;text-align:left"><tbody><tr><th colspan="2" class="infobox-above" style="background:#cde;text-align:center">Urcea</th></tr><tr><td colspan="2" class="infobox-image"><span class="mw-default-size" typeof="mw:File"><a href="/wiki/File:Flag.png" class="mw-file-description"><img src="/img/Flag.png" width="200" height="100" class="mw-file-element"></a></span></td></tr><tr><th scope="row" class="infobox-label">Capital</th><td class="infobox-data">Valmora</td></tr></tbody></table></div><table class="wikitable sortable" style="width:100%; background: #f8f9fa; border: 1px solid #a2a9b1"><tr><th>A</th></tr></table></div>';
    expect(stripPositioning(html)).toBe(html);
  });
});

describe("through the article sanitizer first, as the fallback render does", () => {
  // The fallback path of render.ts: sanitize the parsed HTML, then strip positioning. The sanitizer keeps `style`,
  // so whatever it lets through must not reach the stored post with an overlay in it.
  const pipeline = (html: string): string => stripPositioning(sanitizeWikiArticleHtml(html));
  describe("sanitize then strip", () => {
    it.each([["U+2003", " "]])(
      "leaves no overlay style behind a bad url that starts with %s",
      (_name, space) => {
        const html = `<div style="a:url(${space}&quot;y);position:absolute;inset:0;z-index:9999;b:&quot;)">x</div>`;
        const out = pipeline(html);

        expect(out).toContain("x");
        expect(out).not.toMatch(/position|inset|z-index/i);
      }
    );

    it("keeps a normal infobox style", () => {
      const out = pipeline(
        '<table class="infobox" style="width:22em;background:#f8f9fa url(https://ixwiki.com/images/bg.png);float:right"><tr><td>x</td></tr></table>'
      );

      expect(out).toContain("width:22em");
      expect(out).toContain("float:right");
      expect(out).toContain("url(https://ixwiki.com/images/bg.png)");
    });
  });
});
