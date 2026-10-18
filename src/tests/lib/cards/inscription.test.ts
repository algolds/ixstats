/** @jest-environment node */
/** The inscription text rule (spec §2.2): the sign dialog's preview and the server apply the same check. */
import { INSCRIPTION_MAX, sanitizeInscription } from "~/lib/cards/inscription";

describe("sanitizeInscription", () => {
  it("normalises, collapses whitespace and trims", () => {
    expect(sanitizeInscription("  Pulled  it\nfirst\ttry  ")).toEqual({
      ok: true,
      text: "Pulled it first try",
    });
    // "Cafe" with a combining acute composes to the one "é"
    expect(sanitizeInscription("Café")).toEqual({ ok: true, text: "Café" });
    expect(sanitizeInscription("a  b c　d")).toEqual({
      ok: true,
      text: "a b c d",
    });
  });

  it("strips invisible and direction-changing characters", () => {
    expect(sanitizeInscription("gg​‮wp⁦")).toEqual({ ok: true, text: "ggwp" });
    // Removed before the spaces collapse, so a space each side of one leaves one space; the BOM is removed too
    expect(sanitizeInscription("a ​ b﻿c\u0000\u007f")).toEqual({
      ok: true,
      text: "a bc",
    });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(sanitizeInscription("★".repeat(INSCRIPTION_MAX)).ok).toBe(true);
    // Each emoji is two UTF-16 units
    expect(sanitizeInscription("\u{1F600}".repeat(INSCRIPTION_MAX))).toEqual({
      ok: true,
      text: "\u{1F600}".repeat(INSCRIPTION_MAX),
    });
    // Counted after the clean-up: the invisible characters and the outer spaces do not count
    expect(sanitizeInscription(`  ${"a​".repeat(INSCRIPTION_MAX)}  `).ok).toBe(true);
    expect(sanitizeInscription("a".repeat(INSCRIPTION_MAX + 1))).toEqual({
      ok: false,
      reason: "Keep it to 60 characters.",
    });
  });

  it.each([
    ["", "Write something to sign this card."],
    ["​ ", "Write something to sign this card."],
    ["<b>hi</b>", "Angle brackets aren't allowed."],
    ["gg >", "Angle brackets aren't allowed."],
    ["see https://x.y", "Links aren't allowed."],
    ["HTTP://X.Y", "Links aren't allowed."],
    ["www.example.com", "Links aren't allowed."],
    ["WWW.example.com", "Links aren't allowed."],
  ])("refuses %j", (raw, reason) => {
    expect(sanitizeInscription(raw)).toEqual({ ok: false, reason });
  });

  it("takes words that only look like part of a link", () => {
    expect(sanitizeInscription("http and www, no dots")).toEqual({
      ok: true,
      text: "http and www, no dots",
    });
  });
});
