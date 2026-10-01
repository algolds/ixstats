/** @jest-environment node */
/**
 * Plan 406: the inbound rule "fast-forward or park". `decideInbound` is pure, so every branch is a row.
 */
import {
  decideInbound,
  type InboundDecision,
  type InboundHead,
  type InboundRevision,
} from "~/lib/wiki-os/services/inbound-decision";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";

const HEAD_TEXT = "The head text.\n";
const HEAD_SHA1 = mwSha1Base36(HEAD_TEXT);
const OTHER_SHA1 = mwSha1Base36("Somebody else's text.");
const THIRD_SHA1 = mwSha1Base36("A third text.");

const head = (over: Partial<InboundHead> = {}): InboundHead => ({
  mwRevId: 100,
  sha1: HEAD_SHA1,
  wikitext: HEAD_TEXT,
  ...over,
});

const rev = (over: Partial<InboundRevision> = {}): InboundRevision => ({
  revid: 101,
  parentid: 100,
  sha1: OTHER_SHA1,
  byMirrorBot: false,
  ...over,
});

interface Row {
  name: string;
  head: InboundHead | null;
  rev: InboundRevision;
  parentSha1?: string | null;
  expected: InboundDecision;
}

const rows: Row[] = [
  { name: "the page is new to WikiOS", head: null, rev: rev({ parentid: 0 }), expected: "fast-forward" },
  {
    name: "the page exists in WikiOS but has no revision",
    head: null,
    rev: rev({ parentid: 77 }),
    expected: "fast-forward",
  },
  {
    name: "the edit's parent is the head by MediaWiki revision id",
    head: head(),
    rev: rev({ parentid: 100 }),
    expected: "fast-forward",
  },
  {
    name: "the head has no stored hash: it is computed from its text",
    head: head({ sha1: null }),
    rev: rev({ sha1: HEAD_SHA1, parentid: 55 }),
    expected: "echo",
  },
  {
    name: "the edit has exactly the head's text (the mirror's export coming back)",
    head: head({ mwRevId: null }),
    rev: rev({ sha1: HEAD_SHA1, parentid: 55 }),
    expected: "echo",
  },
  {
    name: "the edit's text is the head's without its trailing newline (MediaWiki trims what it saves)",
    head: head({ sha1: null }),
    rev: rev({ sha1: mwSha1Base36("The head text."), parentid: 55 }),
    expected: "echo",
  },
  {
    name: "an edit by the mirror account is an echo whatever its text",
    head: head({ mwRevId: 90 }),
    rev: rev({ byMirrorBot: true, parentid: 12, sha1: THIRD_SHA1 }),
    expected: "echo",
  },
  {
    name: "the head was never stamped, but the parent has exactly the head's text",
    head: head({ mwRevId: null }),
    rev: rev({ parentid: 55 }),
    parentSha1: HEAD_SHA1,
    expected: "fast-forward",
  },
  {
    name: "the head is stamped with an older revision, but the parent has the head's text (a copy pushed back after a park)",
    head: head({ mwRevId: 90 }),
    rev: rev({ parentid: 95 }),
    parentSha1: HEAD_SHA1,
    expected: "fast-forward",
  },
  {
    name: "the parent's text differs from the head's: the author never saw WikiOS's edit",
    head: head({ mwRevId: null }),
    rev: rev({ parentid: 55 }),
    parentSha1: THIRD_SHA1,
    expected: "park",
  },
  {
    name: "the parent is another revision and its hash was not fetched",
    head: head({ mwRevId: 90 }),
    rev: rev({ parentid: 95 }),
    parentSha1: null,
    expected: "park",
  },
  {
    name: "a page created in MediaWiki while WikiOS already has one with other text",
    head: head({ mwRevId: null }),
    rev: rev({ parentid: 0 }),
    expected: "park",
  },
];

describe("decideInbound", () => {
  it.each(rows)("$name -> $expected", ({ head: h, rev: r, parentSha1, expected }) => {
    expect(decideInbound({ head: h, rev: r, parentSha1: parentSha1 ?? null })).toBe(expected);
  });

  it("covers every decision", () => {
    expect(new Set(rows.map((row) => row.expected))).toEqual(new Set(["echo", "fast-forward", "park"]));
    expect(rows.length).toBeGreaterThanOrEqual(8);
  });
});
