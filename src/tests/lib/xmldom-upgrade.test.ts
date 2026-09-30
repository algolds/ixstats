/**
 * Regression/behavior-pinning tests for the @xmldom/xmldom 0.8 → 0.9 upgrade
 * (plan 323, Step B). These pin current parsing behavior for the app's
 * server-side xmldom call sites so a version bump can't silently change
 * output for valid input or defeat the fatal-error-throws-on-malformed-XML
 * contract that the Discord markdown fallback and SVG parsers depend on.
 */
import { describe, expect, it } from "@jest/globals";
import { DOMParser } from "@xmldom/xmldom";
import { htmlToDiscordMarkdown } from "~/lib/discord/ixtwitter-sync";
import { parseSvgToGeoJson } from "~/lib/flags/svg-parser";

describe("xmldom upgrade — behavior pinning", () => {
  it("htmlToDiscordMarkdown renders bold/italic the same as before the upgrade", () => {
    // Pinned against @xmldom/xmldom@0.8.15 output, captured before the 0.9 upgrade.
    expect(htmlToDiscordMarkdown("<b>bold</b> and <i>it</i>")).toBe("**bold** and *it*");
  });

  it("htmlToDiscordMarkdown does not throw on unclosed tags and returns a string", () => {
    const result = htmlToDiscordMarkdown("<div><b>unclosed");
    expect(typeof result).toBe("string");
    // autoCloseHtmlTags closes the dangling <b> before XML parsing runs, so this
    // still goes through the XML path (not the regex fallback) both pre- and
    // post-upgrade. Pinned against 0.8.15 output.
    expect(result).toBe("**unclosed**");
  });

  it("parseSvgToGeoJson extracts at least one feature from a minimal valid SVG", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g><path d="M0 0 L1 0 L1 1 Z"/></g></svg>';
    const result = parseSvgToGeoJson(svg, "test");
    expect(result.features.length).toBeGreaterThanOrEqual(1);
  });

  it("records the outcome class for malformed SVG (throws vs empty result)", () => {
    // Outcome class pinned as "throws" on both 0.8.15 and 0.9.x, though the
    // specific error changed: on 0.8.15 xmldom does not treat the unclosed <g>
    // as fatal (it emits a non-fatal warning and returns a lenient document),
    // so parseSvgToGeoJson's own "layer not found" guard throws instead. On
    // 0.9.x xmldom reports the mismatched tag as a fatalError and throws a
    // ParseError directly from parseFromString. Either way the caller sees a
    // thrown error, never a silent empty result.
    const malformed = "<svg><g></svg>";
    expect(() => parseSvgToGeoJson(malformed, "test")).toThrow();
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
    expect(Date.now() - t).toBeLessThan(2000);
  });
});
