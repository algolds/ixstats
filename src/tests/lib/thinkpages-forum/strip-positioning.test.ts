/** @jest-environment node */
import {
  stripClassTokens,
  stripPositioning,
  stripStyleDeclarations,
} from "~/lib/thinkpages-forum/strip-positioning";

describe("stripStyleDeclarations", () => {
  it.each([
    ["position:fixed;inset:0;z-index:99999;color:red", "color:red"],
    ["POSITION : Absolute ; top:0; left:0; right:0; bottom:0; width:10px", "width:10px"],
    ["transform:translate(-50%,-50%);translate:10px;scale:3;rotate:4deg;color:blue", "color:blue"],
    ["-webkit-transform:scale(9);-ms-transform:none;margin:0", "margin:0"],
    ["inset-block:0;inset-inline-start:0;inset-block-end:0;padding:1px", "padding:1px"],
    ["z-index:2;color:red", "color:red"],
    ["position:sticky", ""],
    ["background-attachment:fixed;color:red", "color:red"],
    ["color:red;/* position:fixed */font-weight:bold", "color:red;font-weight:bold"],
  ])("removes overlay properties from %s", (input, expected) => {
    expect(stripStyleDeclarations(input)).toBe(expected);
  });

  it("returns a style with nothing to remove exactly as written", () => {
    const style = "width: 22em; float: right ;text-align:left";
    expect(stripStyleDeclarations(style)).toBe(style);
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
      ["an escaped paren", "a:\\(;position:\\66ixed;inset:0"],
      ["a string a newline ends", 'a:"x\n;position:\\66ixed;top:0'],
      ["a string a newline ends, plain values", 'a:"x\n;position:fixed;top:0'],
      ["a carriage return in a string", 'a:"x\r;position:fixed'],
      ["a form feed in a string", "a:'x\f;position:fixed"],
      ["an escaped value (short form)", "position:\\66ixed;color:red"],
      ["an escaped value (long form)", "position:\\000066ixed;color:red"],
      ["an escaped value in a kept property", "color:red;display:\\66ixed"],
      ["a backslash inside a string", 'font-family:"a\\"b";position:fixed'],
      ["an unterminated string", 'font-family:"abc;position:fixed'],
      ["an unterminated single-quoted string", "font-family:'abc;position:fixed"],
      ["an unclosed paren", "background:url(a;position:fixed"],
      ["a stray closing paren", "a:);position:fixed;color:red"],
    ])("%s", (_name, input) => {
      expect(stripStyleDeclarations(input)).toBe("");
    });

    it.each([
      [
        "a double quote inside an unquoted url()",
        'a:url(x"y);position:absolute;inset:0;z-index:9999;b:")',
      ],
      [
        "a single quote inside an unquoted url()",
        "a:url(x'y);position:absolute;inset:0;z-index:9999;b:')",
      ],
      ["a paren inside an unquoted url()", "a:url(a(b);position:absolute;inset:0;z-index:9999;b:)"],
      ["the same with upper-case URL(", 'a:URL(x"y);position:fixed;top:0;b:")'],
      ["an unquoted url() nested in a function", 'a:image-set(url(x"y)),position:fixed;top:0;b:")'],
      ["an unquoted url() that never closes", "a:url(x;position:fixed"],
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

    it("does not let a comment marker inside a string hide a declaration", () => {
      expect(stripStyleDeclarations('a:"/*";position:fixed;b:"*/"')).toBe('a:"/*";b:"*/"');
    });

    it("keeps balanced quotes, parens, nested functions and comments", () => {
      const style =
        'font-family:\'A;B\', "C";background:url("a;b.png");width:calc(10px + (2px * 3))';
      expect(stripStyleDeclarations(style)).toBe(style);
      expect(stripStyleDeclarations('color:red;/* " ( */width:1px')).toBe("color:red;width:1px");
    });
  });

  it("drops a declaration without a property or a colon", () => {
    expect(stripStyleDeclarations("junk;;color:red;:oops")).toBe("color:red");
  });

  it("keeps semicolons inside strings and url() values", () => {
    expect(stripStyleDeclarations('font-family:"A;B";position:fixed')).toBe('font-family:"A;B"');
    expect(stripStyleDeclarations("background:url(a;b.png);top:0")).toBe("background:url(a;b.png)");
  });

  it("treats an unterminated comment as swallowing the rest", () => {
    expect(stripStyleDeclarations("color:red;/* position:fixed")).toBe("color:red");
  });

  it("keeps harmless declarations and custom properties", () => {
    const style = "text-align:center;--x:1;width:50%";
    expect(stripStyleDeclarations(style)).toBe(style);
  });
});

describe("stripClassTokens", () => {
  it.each([
    ["fixed inset-0 z-50", ""],
    ["absolute sticky relative", ""],
    ["top-0 left-0 right-0 bottom-0 start-0 end-0", ""],
    ["inset-x-0 inset-y-4 inset-1/2 top-1/2 -top-4", ""],
    ["-translate-x-1/2 translate-y-2 transform", ""],
    ["md:fixed hover:absolute !fixed sm:-z-10 max-md:inset-0", ""],
    ["[position:fixed] z-[9999] top-[10px] inset-(--x)", ""],
    [
      "wikitable infobox mw-parser-output infobox-header navbox floatright",
      "wikitable infobox mw-parser-output infobox-header navbox floatright",
    ],
    ["fixed-width left-hand wikitable", "fixed-width left-hand wikitable"],
    ["a fixed b", "a b"],
    ["", ""],
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

  it("removes an emptied style or class attribute", () => {
    expect(stripPositioning('<div style="position:fixed" class="fixed">x</div>')).toBe(
      "<div>x</div>"
    );
  });

  it("handles single-quoted and unquoted attributes and self-closing tags", () => {
    expect(stripPositioning("<span style='position:fixed' class=fixed>x</span><br/>")).toBe(
      "<span>x</span><br/>"
    );
  });

  it("is not fooled by > inside another attribute's value", () => {
    expect(
      stripPositioning(
        '<a title="a > b" style="position:fixed;color:red" href="/x?a=1&amp;b=2">t</a>'
      )
    ).toBe('<a title="a > b" style="color:red" href="/x?a=1&amp;b=2">t</a>');
  });

  it("round-trips the entities a style value carries", () => {
    expect(stripPositioning('<p style="font-family:&quot;A;B&quot;;position:fixed">x</p>')).toBe(
      '<p style="font-family:&quot;A;B&quot;">x</p>'
    );
  });

  it("drops a style or class token that hides characters in other entities", () => {
    expect(stripPositioning('<p style="position&colon;fixed">x</p>')).toBe("<p>x</p>");
    expect(stripPositioning('<p style="color:red" class="a&#102;ixed b">x</p>')).toBe(
      '<p style="color:red" class="b">x</p>'
    );
  });

  it.each([
    "a:\\&quot;;position:\\66ixed;inset:0;z-index:9999",
    "a:\\(;position:\\66ixed;inset:0",
    "a:&quot;x\n;position:\\66ixed;top:0",
    "position:\\66ixed;inset:0",
    "position:\\000066ixed;inset:0",
    "p\\6fsition:fixed",
  ])("removes the style attribute that holds %j", (style) => {
    expect(stripPositioning(`<div class="keep" style="${style}">Please sign in</div>`)).toBe(
      '<div class="keep">Please sign in</div>'
    );
  });

  it.each([
    "a:url(x&quot;y);position:absolute;inset:0;z-index:9999;b:&quot;)",
    "a:url(x&#39;y);position:absolute;inset:0;z-index:9999;b:&#39;)",
    "a:url(a(b);position:absolute;inset:0;z-index:9999;b:)",
  ])("removes the style attribute that hides a declaration behind a bad url: %j", (style) => {
    expect(stripPositioning(`<div class="keep" style="${style}">x</div>`)).toBe(
      '<div class="keep">x</div>'
    );
  });

  it("keeps a MediaWiki infobox style, with entities and url()", () => {
    const html =
      '<table class="infobox" style="width:22em;background:#f8f9fa url(&quot;/img/bg.png&quot;);font-family:&quot;Linux Libertine&quot;, serif;border:1px solid #a2a9b1"><tr><td style="padding:0.2em 0.4em;line-height:1.2em">x</td></tr></table>';
    expect(stripPositioning(html)).toBe(html);
  });

  it("leaves text and escaped markup alone", () => {
    const html = '<p>&lt;div style="position:fixed"&gt; is escaped</p>';
    expect(stripPositioning(html)).toBe(html);
  });

  it("leaves a real-looking infobox and table intact", () => {
    const html =
      '<div class="mw-parser-output"><div class="forum-infobox"><table class="infobox infobox-country" style="width:22em;float:right;text-align:left"><tbody><tr><th colspan="2" class="infobox-above" style="background:#cde;text-align:center">Urcea</th></tr><tr><td colspan="2" class="infobox-image"><span class="mw-default-size" typeof="mw:File"><a href="/wiki/File:Flag.png" class="mw-file-description"><img src="/img/Flag.png" width="200" height="100" class="mw-file-element"></a></span></td></tr><tr><th scope="row" class="infobox-label">Capital</th><td class="infobox-data">Valmora</td></tr></tbody></table></div><table class="wikitable sortable" style="width:100%; background: #f8f9fa; border: 1px solid #a2a9b1"><tr><th>A</th></tr></table></div>';
    expect(stripPositioning(html)).toBe(html);
  });
});
