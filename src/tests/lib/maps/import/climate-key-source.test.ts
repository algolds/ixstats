/** @jest-environment node */
import { readClimateKeySource } from "~/lib/maps/import/climate-key-source";
describe("readClimateKeySource", () => {
  it("takes a hex colour and a full link as they are, and leaves out a link that is not https", () => {
    const source = `const Z = [{ code: "ET", name: "Tundra", color: "#B2B2B2", link: "javascript:alert(1)" },
      { code: "EF", name: "Ice Cap", color: "#686868", wiki: "https://example.org/ef" }];`;
    expect(readClimateKeySource(source, { system: "Köppen", zonesBinding: "Z" }).zones).toEqual([
      { code: "ET", name: "Tundra", color: "#b2b2b2" },
      { code: "EF", name: "Ice Cap", color: "#686868", link: "https://example.org/ef" },
    ]);
  });

  it("refuses a zone without a colour and a file that is not plain data", () => {
    expect(() =>
      readClimateKeySource(`const Z = [{ code: "Af", name: "Rainforest" }];`, {
        system: "Köppen",
        zonesBinding: "Z",
      })
    ).toThrow(/colour/);
    expect(() =>
      readClimateKeySource(`const Z = [{ code: run() }];`, { system: "Köppen", zonesBinding: "Z" })
    ).toThrow();
  });
});
