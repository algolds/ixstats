import { describe, it, expect } from "@jest/globals";
import { parseAffectedCountries } from "~/lib/maps/crisis-affected-countries";

describe("parseAffectedCountries", () => {
  it("parses a JSON array of country ids", () => {
    expect(parseAffectedCountries('["c1","c2"]')).toEqual(["c1", "c2"]);
  });
  it("splits legacy comma-separated values", () => {
    expect(parseAffectedCountries("a, b,,c")).toEqual(["a", "b", "c"]);
  });

  it("falls back to the comma split when JSON is malformed", () => {
    expect(parseAffectedCountries("[a")).toEqual(["[a"]);
    expect(parseAffectedCountries("[a, b")).toEqual(["[a", "b"]);
  });
});
