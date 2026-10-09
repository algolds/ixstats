/** @jest-environment node */
import { replacePairs, type PairSpec } from "~/lib/thinkpages-forum/import/bbcode-pairs";

/** A small deterministic generator (mulberry32), so a failure reproduces. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIECES = [
  "[b]",
  "[/b]",
  "[B]",
  "[/B]",
  "[b x]",
  "[b=1]",
  "[br]",
  "[url=",
  "[url]",
  "[/url]",
  "[url a]",
  "[quote]",
  "[quote=x]",
  "[/quote]",
  "[quotes]",
  "[attach]",
  "[attach=full]",
  "[attach x]",
  "[/attach]",
  "12",
  "x",
  " ",
  "]",
  "[",
  "\n",
];

function samples(count: number, seed: number): string[] {
  const next = random(seed);
  return Array.from({ length: count }, () =>
    Array.from({ length: 1 + Math.floor(next() * 14) }, () =>
      String(PIECES[Math.floor(next() * PIECES.length)])
    ).join("")
  );
}

const wrap = (opener: RegExpExecArray, content: string) =>
  `<${opener.slice(1).join("|")}>{${content}}`;

const CASES: Array<[string, PairSpec, RegExp]> = [
  ["a bare tag", { tag: "b", rest: /\]/y, render: wrap }, /\[b\]([\s\S]*?)\[\/b\]/gi],
  [
    "an option with a value",
    { tag: "url", rest: /=([^\]]+)\]/y, render: wrap },
    /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
  ],
  [
    "attributes",
    { tag: "url", rest: /(?:\s[^\]]*)?\]/y, render: wrap },
    /\[url(?:\s[^\]]*)?\]([\s\S]*?)\[\/url\]/gi,
  ],
  [
    "a numeric body",
    { tag: "attach", rest: /(?:=full|\s[^\]]*)?\]/iy, body: /\d+/y, render: wrap },
    /\[attach(?:=full|\s[^\]]*)?\](\d+)\[\/attach\]/gi,
  ],
  [
    "innermost pairs",
    { tag: "quote", rest: /(?:=["']?([^"\]]*?)["']?)?\]/y, innermost: true, render: wrap },
    /\[quote(?:=["']?([^"\]]*?)["']?)?\]((?:(?!\[quote)[\s\S])*?)\[\/quote\]/gi,
  ],
];

describe("replacePairs", () => {
  it.each(CASES)("matches the regex it replaces for %s", (_, spec, regex) => {
    for (const input of samples(4000, 7)) {
      // The regex's last group is the content; the ones before it are the opener's.
      const expected = input.replace(regex, (...args: string[]) => {
        const groups = args.slice(1, -2);
        const content = groups.pop() ?? "";
        const opener = Object.assign([args[0], ...groups], { index: 0, input }) as RegExpExecArray;
        return wrap(opener, content);
      });
      expect({ input, out: replacePairs(input, spec) }).toEqual({ input, out: expected });
    }
  });

  it("leaves text without pairs unchanged", () => {
    expect(replacePairs("a [b] c ] d", { tag: "b", rest: /\]/y, render: wrap })).toBe(
      "a [b] c ] d"
    );
  });
});
