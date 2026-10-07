/** @jest-environment node */
/**
 * GDP figures are money: a currency symbol or code before the number, "trillion" or "bn" after it. `parseMoney`
 * reads them, and refuses a figure it cannot scale instead of keeping only its leading digits; the infobox
 * parser reads every GDP field with it.
 */
import { parseInfoboxWithTemplates } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import { parseMoney } from "~/lib/wiki-os/transformers/infobox-parser";

describe("parseMoney", () => {
  it.each([
    ["$45,000", 45_000],
    ["US$ 45,000", 45_000],
    ["Int$ 32,100", 32_100],
    ["USD 45,000", 45_000],
    ["NSD45,000", 45_000],
    ["£12,345.67", 12_346],
    ["¥ 4,500,000", 4_500_000],
    ["$1.5 trillion", 1_500_000_000_000],
    ["1.5 trillion", 1_500_000_000_000],
    ["€2.3 billion", 2_300_000_000],
    ["$820 million", 820_000_000],
    ["$1.2tn", 1_200_000_000_000],
    ["€2.3 bn", 2_300_000_000],
    ["$45k", 45_000],
    ["{{formatnum:45000}}", 45_000],
    ["${{formatnum:45000}}", 45_000],
    ["{{nowrap|$1.5 trillion}}", 1_500_000_000_000],
    ["45,000 (2025 est.)", 45_000],
    ["45 000 USD", 45_000],
    ["{{increase}} $45,000<ref>IMF, 2025</ref>", 45_000],
    ["approx. $1.5&nbsp;trillion", 1_500_000_000_000],
    ["[[United States dollar|$]]45,000", 45_000],
  ])("%s is %d", (text, expected) => {
    expect(parseMoney(text)).toBe(expected);
  });

  it.each([
    ["45 quadrillion"], // a magnitude it does not know: no leading-digits guess
    ["2.300.000"], // dots as thousand separators are ambiguous
    ["1,5 billion"], // a decimal comma likewise
    ["Ranked 12th"],
    ["unknown"],
    [""],
    ["$0"],
  ])("%s is not a figure", (text) => {
    expect(parseMoney(text)).toBeNull();
  });
});

describe("parseInfoboxWithTemplates reads GDP fields as money", () => {
  it("fills gdp_nominal and gdpPerCapita from currency-prefixed, trillion-scaled values", () => {
    const parsed = parseInfoboxWithTemplates(
      [
        "{{Infobox country",
        "| conventional_long_name = Federal Republic of Aurelia",
        "| population_estimate = 30,000,000",
        "| GDP_nominal = $1.5 trillion",
        "| GDP_nominal_per_capita = US$ 50,000",
        "| GDP_PPP = Int$ 2.1 trillion",
        "}}",
      ].join("\n"),
      "Aurelia"
    );
    expect(parsed).toMatchObject({
      population_estimate: 30_000_000,
      gdp_nominal: 1_500_000_000_000,
      gdpPerCapita: 50_000,
      gdp_ppp: 2_100_000_000_000,
    });
  });

  it("leaves a GDP it cannot read unset rather than misread", () => {
    const parsed = parseInfoboxWithTemplates(
      "{{Infobox country\n| GDP_nominal = 45 quadrillion\n}}",
      "Aurelia"
    );
    expect(parsed?.gdp_nominal).toBeUndefined();
  });
});
