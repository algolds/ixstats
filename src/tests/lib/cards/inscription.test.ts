/** @jest-environment node */
/**
 * The inscription text rule (spec §2.2): the sign dialog's preview and the server apply the same check. An inscription
 * is printed on the card back of every later holder, so whatever cannot be seen, or breaks the card, does not get in.
 */
import { INSCRIPTION_MAX, sanitizeInscription } from "~/lib/cards/inscription";

describe("sanitizeInscription", () => {
  it("collapses whitespace and trims", () => {
    expect(sanitizeInscription("  Pulled  it\nfirst\ttry  ")).toEqual({
      ok: true,
      text: "Pulled it first try",
    });
    expect(sanitizeInscription("a\u00a0\u2003b\u2028c\u3000d")).toEqual({
      ok: true,
      text: "a b c d",
    });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(sanitizeInscription("\u2605".repeat(INSCRIPTION_MAX)).ok).toBe(true);
    // Each emoji is two UTF-16 units
    expect(sanitizeInscription("\u{1F600}".repeat(INSCRIPTION_MAX))).toEqual({
      ok: true,
      text: "\u{1F600}".repeat(INSCRIPTION_MAX),
    });
    // Counted after the clean-up: the invisible characters and the outer spaces do not count
    expect(sanitizeInscription(`  ${"a\u200b".repeat(INSCRIPTION_MAX)}  `).ok).toBe(true);
    expect(sanitizeInscription("a".repeat(INSCRIPTION_MAX + 1))).toEqual({
      ok: false,
      reason: "Keep it to 60 characters.",
    });
  });

  /** One case or more per rule: what goes in, and what is stored. */
  it.each([
    // Invisible and direction-changing characters go: zero-width space, an override, an isolate
    ["invisible characters", "gg\u200b\u202ewp\u2066", "ggwp"],
    // Removed before the spaces collapse, so a space each side of one leaves one space; the BOM, NUL and DEL go too
    ["the BOM and controls", "a \u200b b\ufeffc\u0000\u007f", "a bc"],
    // Tag characters can carry hidden text
    ["tag characters", "hi\u{E0068}\u{E0069}", "hi"],
    // Letters that draw as nothing
    ["a Hangul filler", "a\u3164b", "ab"],
    ["the braille blank", "a\u2800b", "ab"],
    // A joiner between two letters or two emoji stays
    [
      "a family emoji",
      "\u{1F468}\u200d\u{1F469}\u200d\u{1F467}",
      "\u{1F468}\u200d\u{1F469}\u200d\u{1F467}",
    ],
    [
      "Persian with a non-joiner",
      "\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645",
      "\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645",
    ],
    // Anywhere else a joiner only hides
    ["a joiner at the end", "ab\u200d", "ab"],
    ["a joiner from a letter to an emoji", "a\u200d\u{1F600}", "a\u{1F600}"],
    ["a run of joiners", "a\u200d\u200db", "ab"],
    // NFC comes last, so a mark split from its letter by an invisible character still composes
    ["NFC after the clean-up", "e\u200b\u0301", "\u00e9"],
    // Four marks in a row are fine (Hebrew pointing, Indic stacks)
    ["four marks on one letter", "x\u0300\u0301\u0302\u0303", "x\u0300\u0301\u0302\u0303"],
    // Angle brackets that cannot open a tag
    ["a heart", "gg <3", "gg <3"],
    ["words that only look like part of a link", "http and www, no dots", "http and www, no dots"],
  ])("takes %s", (_, raw, text) => {
    expect(sanitizeInscription(raw)).toEqual({ ok: true, text });
  });

  it.each([
    ["nothing", "", "Write something to sign this card."],
    ["only invisible characters", "\u200b \u200d", "Write something to sign this card."],
    [
      "only blank-looking letters",
      "\u3164\u3164\u2800\uffa0\u115f\u1160\u034f",
      "Write something to sign this card.",
    ],
    [
      "five marks on one letter",
      "x\u0300\u0301\u0302\u0303\u0304",
      "Use fewer marks on one letter.",
    ],
    ["a tag", "<b>hi</b>", "HTML tags aren't allowed."],
    ["a comment", "<!-- x", "HTML tags aren't allowed."],
    ["a tag in another script", "<\u0434>", "HTML tags aren't allowed."],
    ["a link", "see https://x.y", "Links aren't allowed."],
    ["a www address in capitals", "WWW.example.com", "Links aren't allowed."],
    ["a lone high surrogate", "ab\ud800", "This text has a broken character."],
  ])("refuses %s", (_, raw, reason) => {
    expect(sanitizeInscription(raw)).toEqual({ ok: false, reason });
  });
});
