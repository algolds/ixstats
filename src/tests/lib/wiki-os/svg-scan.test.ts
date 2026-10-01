/** @jest-environment node */
/**
 * Plan 411 review (minor 4): the hostile-SVG vectors the verifier tried, kept as a regression table. Every one of the
 * hostile files must be refused and every legitimate one accepted, plus the bounds (attribute count and length, linear time).
 */
import { sniffFile } from "~/lib/wiki-os/core/file-sniff";
import { scanSvg } from "~/lib/wiki-os/core/svg-scan";

/** Why an SVG text is refused, or null. */
const svgProblem = (text: string) => scanSvg(text).problem;

const enc = (s: string) => new TextEncoder().encode(s);
const NS = 'xmlns="http://www.w3.org/2000/svg"';

// [name, body] : every one of these must be REFUSED (script / external load / injection)
const mustRefuse: Array<[string, string | Uint8Array]> = [
  ["script element", `<svg ${NS}><script>alert(1)</script></svg>`],
  ["script upper", `<svg ${NS}><SCRIPT>alert(1)</SCRIPT></svg>`],
  [
    "svg:script prefix",
    `<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:script>alert(1)</svg:script></svg:svg>`,
  ],
  [
    "script xlink href",
    `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink"><script xlink:href="data:,alert(1)"/></svg>`,
  ],
  [
    "foreignObject",
    `<svg ${NS}><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x /></body></foreignObject></svg>`,
  ],
  ["onload", `<svg ${NS} onload="alert(1)"/>`],
  ["onload slash", `<svg ${NS}/onload=alert(1)>`],
  ["onload mixed case", `<svg ${NS} OnLoAd="alert(1)"/>`],
  ["onclick on rect", `<svg ${NS}><rect onclick="alert(1)" width="9" height="9"/></svg>`],
  ["use external href", `<svg ${NS}><use href="//evil.example/x.svg#a"/></svg>`],
  ["use external https", `<svg ${NS}><use href="https://evil.example/x.svg#a"/></svg>`],
  [
    "use xlink javascript",
    `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>`,
  ],
  [
    "a href entity-obfuscated",
    `<svg ${NS}><a href="jav&#x61;script:alert(1)"><text>x</text></a></svg>`,
  ],
  ["a href tab/newline", `<svg ${NS}><a href="java&#x09;script:alert(1)"><text>x</text></a></svg>`],
  [
    "a href leading zeros hex ref",
    `<svg ${NS}><a href="j&#x0000061;vascript:alert(1)"><text>x</text></a></svg>`,
  ],
  [
    "a href decimal long",
    `<svg ${NS}><a href="j&#0000097;vascript:alert(1)"><text>x</text></a></svg>`,
  ],
  ["a href named colon", `<svg ${NS}><a href="javascript&colon;alert(1)"><text>x</text></a></svg>`],
  [
    "a href data html",
    `<svg ${NS}><a href="data:text/html,<script>alert(1)</script>"><text>x</text></a></svg>`,
  ],
  ["image href data svg", `<svg ${NS}><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>`],
  [
    "animate href",
    `<svg ${NS}><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>`,
  ],
  [
    "set xlink:href",
    `<svg ${NS}><a><set attributeName="xlink:href" to="javascript:alert(1)"/><text>x</text></a></svg>`,
  ],
  [
    "set onmouseover",
    `<svg ${NS}><rect width="10" height="10"><set attributeName="onmouseover" to="alert(1)"/></rect></svg>`,
  ],
  ["style url external", `<svg ${NS}><style>rect{fill:url(//evil.example/a)}</style></svg>`],
  [
    "style attr url external",
    `<svg ${NS}><rect style="fill:url('https://evil.example/a')"/></svg>`,
  ],
  ["style import", `<svg ${NS}><style>@import url(//evil.example/x.css);</style></svg>`],
  ["style import escaped", `<svg ${NS}><style>@\\69mport "//evil.example/x.css";</style></svg>`],
  [
    "style url escaped fn name",
    `<svg ${NS}><style>rect{fill:\\75rl(//evil.example/a)}</style></svg>`,
  ],
  ["style url spaced", `<svg ${NS}><style>rect{fill:url (//evil.example/a)}</style></svg>`],
  ["style expression", `<svg ${NS}><rect style="width:expression(alert(1))"/></svg>`],
  [
    "xml-stylesheet PI",
    `<?xml version="1.0"?><?xml-stylesheet href="//evil.example/x.xsl" type="text/xsl"?><svg ${NS}/>`,
  ],
  [
    "ENTITY decl",
    `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "<script>alert(1)</script>">]><svg ${NS}>&x;</svg>`,
  ],
  ["ENTITY lower", `<?xml version="1.0"?><!DOCTYPE svg [<!entity x "y">]><svg ${NS}/>`],
  ["DOCTYPE internal subset", `<?xml version="1.0"?><!DOCTYPE svg [ ]><svg ${NS}/>`],
  ["comment split script", `<svg ${NS}><scr<!-- -->ipt>alert(1)</scr<!-- -->ipt></svg>`],
  ["CDATA script", `<svg ${NS}><script><![CDATA[alert(1)]]></script></svg>`],
  ["iframe", `<svg ${NS}><iframe src="javascript:alert(1)"/></svg>`],
  ["object", `<svg ${NS}><object data="//evil.example/x.html"/></svg>`],
  ["embed", `<svg ${NS}><embed src="//evil.example/x.swf"/></svg>`],
  ["handler element", `<svg ${NS}><handler type="application/ecmascript">alert(1)</handler></svg>`],
  ["listener element", `<svg ${NS}><listener event="load" handler="#h"/></svg>`],
  [
    "xhtml root w/ script",
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><script>alert(1)</script></body></html>`,
  ],
  [
    "xhtml root w/ onerror",
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><img src="x" onerror="alert(1)"/></body></html>`,
  ],
  [
    "xhtml link stylesheet",
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="//evil.example/x.css"/></head><body><svg ${NS}/></body></html>`,
  ],
  [
    "xhtml form action js",
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><form action="javascript:alert(1)"><button type="submit">go</button></form></body></html>`,
  ],
  [
    "xhtml meta refresh",
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="refresh" content="0;url=https://evil.example/"/></head><body><svg ${NS}/></body></html>`,
  ],
  [
    "xhtml formaction",
    `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><form><button type="submit" formaction="https://evil.example/x">go</button></form></body></html>`,
  ],
  [
    "UTF-7 declared",
    `<?xml version="1.0" encoding="UTF-7"?><svg ${NS}>+ADw-script+AD4-alert(1)+ADw-/script+AD4-</svg>`,
  ],
  ["UTF-16 declared ascii body", `<?xml version="1.0" encoding="UTF-16"?><svg ${NS}/>`],
  [
    "UTF-16LE with BOM",
    Uint8Array.from([
      0xff,
      0xfe,
      ...Array.from(`<svg ${NS}><script>alert(1)</script></svg>`).flatMap((c) => [
        c.charCodeAt(0),
        0,
      ]),
    ]),
  ],
  [
    "UTF-16BE with BOM",
    Uint8Array.from([
      0xfe,
      0xff,
      ...Array.from(`<svg ${NS}><script>alert(1)</script></svg>`).flatMap((c) => [
        0,
        c.charCodeAt(0),
      ]),
    ]),
  ],
  [
    "UTF-8 BOM + script",
    Uint8Array.from([0xef, 0xbb, 0xbf, ...enc(`<svg ${NS}><script>alert(1)</script></svg>`)]),
  ],
  ["HTML renamed svg", `<html><body><script>alert(1)</script></body></html>`],
  [
    "HTML doctype w/ svg",
    `<!DOCTYPE html><html><body><svg/><script>alert(1)</script></body></html>`,
  ],
  ["svg w/ trailing html script", `<svg ${NS}/><script>alert(1)</script>`],
  ["leading comment then html", `<!-- x --><html><body onload="alert(1)"><svg/></body></html>`],
  ["attr unquoted onload", `<svg ${NS} onload=alert(1)>`],
  ["attr backtick", "<svg " + NS + " a=`b` onload=alert(1)>"],
  ["attr unterminated quote then onload", `<svg ${NS} a="x onload="alert(1)">`],
  ["tab in tag name", `<svg ${NS}><script\talert(1)></script></svg>`],
  ["newline in tag", `<svg ${NS}><script\n>alert(1)</script></svg>`],
  ["svg/ trick", `<svg/xmlns="http://www.w3.org/2000/svg"/onload=alert(1)>`],
  [
    "mathml xlink",
    `<svg ${NS}><math xmlns="http://www.w3.org/1998/Math/MathML"><maction actiontype="statusline#" xlink:href="javascript:alert(1)">x</maction></math></svg>`,
  ],
  ["xlink:href case", `<svg ${NS}><a XLINK:HREF="javascript:alert(1)"><text>x</text></a></svg>`],
  ["href case", `<svg ${NS}><a HREF="javascript:alert(1)"><text>x</text></a></svg>`],
  [
    "feImage external",
    `<svg ${NS}><filter id="f"><feImage href="https://evil.example/x.png"/></filter></svg>`,
  ],
  ["link rel import", `<svg ${NS}><link rel="import" href="//evil.example/x.html"/></svg>`],
  [
    "xml:base javascript",
    `<svg ${NS} xml:base="javascript:" ><a href="alert(1)"><text>x</text></a></svg>`,
  ],
  ["pi containing script (PI hides?)", `<svg ${NS}><?x <script>alert(1)</script> ?></svg>`],
  ["cdata hiding open tag", `<svg ${NS}><![CDATA[ ]]><script>alert(1)</script></svg>`],
  ["comment end trick", `<svg ${NS}><!-- a --!><script>alert(1)</script> --></svg>`],
  ["svg only in comment", `<!-- <svg> --><html><script>alert(1)</script></html>`],
];

// legit SVGs that MUST be accepted (no false positives on normal art)
const mustAccept: Array<[string, string]> = [
  [
    "plain",
    `<svg ${NS} width="40" height="20" viewBox="0 0 40 20"><rect width="40" height="20" fill="#2a7"/></svg>`,
  ],
  [
    "xml decl + gradient",
    `<?xml version="1.0" encoding="UTF-8"?><svg ${NS}><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><rect fill="url(#g)" width="5" height="5"/></svg>`,
  ],
  [
    "xlink local use",
    `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink"><defs><g id="a"/></defs><use xlink:href="#a"/></svg>`,
  ],
  ["inline png image", `<svg ${NS}><image href="data:image/png;base64,iVBORw0KGgo="/></svg>`],
  ["style block", `<svg ${NS}><style>.a{fill:red}</style><rect class="a"/></svg>`],
  [
    "w3c doctype external",
    `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg ${NS}/>`,
  ],
  ["onwards word in text", `<svg ${NS}><text>online</text></svg>`],
];

describe("SVG scan vectors", () => {
  it.each(mustRefuse)("refuses: %s", (_name, body) => {
    const result = sniffFile(typeof body === "string" ? enc(body) : body);
    expect(result.ok).toBe(false);
  });

  it.each(mustAccept)("accepts: %s", (_name, body) => {
    expect(sniffFile(enc(body))).toMatchObject({ ok: true });
  });
});

describe("SVG scan bounds and reasons", () => {
  it("names what is wrong with the file it refuses", () => {
    const reasons: Array<[string, string]> = [
      [
        `<svg ${NS}><set attributeName="onmouseover" to="x"/></svg>`,
        "it sets an event handler (onmouseover)",
      ],
      [
        `<svg ${NS}><set attributeName="on&#x6d;ouseover" to="x"/></svg>`,
        "it sets an event handler (onmouseover)",
      ],
      [`<svg ${NS}><style>@\\69mport "x";</style></svg>`, "it imports a stylesheet"],
      [
        `<svg ${NS}><style>a{fill:\\75rl(//e.example/a)}</style></svg>`,
        "it refers to something outside the file (url())",
      ],
      [
        `<svg ${NS}><style>a{fill:url (//e.example/a)}</style></svg>`,
        "it refers to something outside the file (url())",
      ],
      [
        `<?xml version="1.0" encoding="UTF-16"?><svg ${NS}/>`,
        "it declares the encoding UTF-16, not UTF-8",
      ],
      [
        `<html xmlns="http://www.w3.org/1999/xhtml"><body><svg/></body></html>`,
        "its root element is <html>, not <svg>",
      ],
      [
        `<svg ${NS}><!-- a --!><script/> --></svg>`,
        "it is not well-formed XML (a comment contains --)",
      ],
      [
        `<svg ${NS} a="x onload="y"/>`,
        "it is not well-formed XML (two attributes are not separated by white space)",
      ],
    ];
    for (const [text, reason] of reasons) expect(svgProblem(text)).toBe(reason);
  });

  it("refuses a tag with more than 256 attributes and a name past 128 characters", () => {
    const attributes = (count: number) =>
      Array.from({ length: count }, (_, i) => `a${i}="1"`).join(" ");
    expect(svgProblem(`<svg ${NS} ${attributes(255)}/>`)).toBeNull();
    expect(svgProblem(`<svg ${NS} ${attributes(256)}/>`)).toBe(
      "it is not well-formed XML (a tag has more than 256 attributes)"
    );
    expect(svgProblem(`<svg ${NS} ${"a".repeat(128)}="1"/>`)).toBeNull();
    expect(svgProblem(`<svg ${NS} ${"a".repeat(129)}="1"/>`)).toBe(
      "it is not well-formed XML (an attribute name is longer than 128 characters)"
    );
  });

  it("refuses a document nested deeper than 2048 elements", () => {
    expect(svgProblem(`<svg>${"<g>".repeat(2_000)}${"</g>".repeat(2_000)}</svg>`)).toBeNull();
    expect(svgProblem(`<svg>${"<g>".repeat(3_000)}${"</g>".repeat(3_000)}</svg>`)).toBe(
      "it is not well-formed XML (elements are nested deeper than 2048)"
    );
  });

  it("does not take a > or a [ inside the quotes of a DOCTYPE for its end or an internal subset", () => {
    expect(svgProblem(`<!DOCTYPE svg SYSTEM "a>[b"><svg/>`)).toBeNull();
    expect(svgProblem(`<!DOCTYPE svg SYSTEM "a>b" [ ]><svg/>`)).toBe(
      "its DOCTYPE has an internal subset"
    );
  });

  it("scans ten megabytes of ordinary art in well under a second", () => {
    const path = `<path d="M0 0L10 10" fill="#123456" stroke="url(#g)" opacity="0.5"/>\n`;
    const text = `<svg ${NS}><defs><linearGradient id="g"/></defs>${path.repeat(Math.floor(10_000_000 / path.length))}</svg>`;
    const started = performance.now();
    expect(svgProblem(text)).toBeNull();
    expect(performance.now() - started).toBeLessThan(1_500);
  });
});
