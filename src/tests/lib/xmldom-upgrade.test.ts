/**
 * Regression/behavior-pinning tests for the @xmldom/xmldom 0.8 → 0.9 upgrade
 * (plan 323, Step B). These pin current parsing behavior for the app's
 * server-side xmldom call sites so a version bump can't silently change
 * output for valid input or defeat the fatal-error-throws-on-malformed-XML
 * contract that the Discord markdown fallback and SVG parsers depend on.
 */
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { describe, expect, it } from "@jest/globals";
import { DOMParser } from "@xmldom/xmldom";
import { extractSvgMetadata } from "~/lib/flags/svg-parser";

describe("xmldom upgrade — behavior pinning", () => {
  it("records the outcome class for malformed SVG (throws, never a silent empty result)", () => {
    // On 0.9.x xmldom reports the mismatched tag as a fatalError and throws a ParseError from parseFromString
    // (0.8.15 was lenient there); either way the caller sees a thrown error.
    expect(() => extractSvgMetadata("<svg><g></svg>")).toThrow();
  });

  it("parses an attack-shaped input (many duplicated attributes) without quadratic blowup", () => {
    const attrs = " a='1'".repeat(5000);
    const attackSvg = `<a${attrs}></a>`;
    const t = Date.now();
    try {
      new DOMParser().parseFromString(attackSvg, "text/xml");
    } catch {
      // rejecting the malformed/oversized input is an acceptable outcome too
    }
    expect(Date.now() - t).toBeLessThan(2000 * TIMING_BUDGET_SCALE);
  });
});
