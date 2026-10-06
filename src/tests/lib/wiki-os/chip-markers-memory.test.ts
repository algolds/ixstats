/** @jest-environment node */
/**
 * Plan 404 review: markTemplateChips made a new jsdom window on every call. A window costs ~0.5 MB
 * the process never gives back, so 2,000 renders of chip pages held 1.5 GB. It now uses one window
 * for the life of the process.
 */
const PAGE =
  '<p>Pop <a href="/wiki/Template:CountryData:Aurelia:population">x</a> and {{MyCountry:gdp}} and ' +
  "filler text to give every page some weight. ".repeat(20) +
  "</p>";

describe("markTemplateChips does not leak a jsdom window per call", () => {
  afterEach(() => {
    jest.dontMock("jsdom");
    jest.resetModules();
  });

  it("creates one jsdom window for any number of calls", () => {
    let windows = 0;
    jest.isolateModules(() => {
      const actual = jest.requireActual<typeof import("jsdom")>("jsdom");
      jest.doMock("jsdom", () => ({
        JSDOM: class {
          readonly window: InstanceType<typeof actual.JSDOM>["window"];
          constructor(...args: ConstructorParameters<typeof actual.JSDOM>) {
            windows++;
            this.window = new actual.JSDOM(...args).window;
          }
        },
      }));
      const { markTemplateChips } =
        require("~/lib/wiki-os/templates/chip-markers") as typeof import("~/lib/wiki-os/templates/chip-markers");

      expect(windows).toBe(0); // created on first use, not at import
      for (let n = 0; n < 2_000; n++) {
        expect(markTemplateChips(PAGE)).toContain(
          'data-wikios-chip="CountryData:Aurelia:population"'
        );
      }
    });

    expect(windows).toBe(1);
  });

  it("does not create a window for a page with no chip in it", () => {
    let windows = 0;
    jest.isolateModules(() => {
      const actual = jest.requireActual<typeof import("jsdom")>("jsdom");
      jest.doMock("jsdom", () => ({
        JSDOM: class {
          readonly window: InstanceType<typeof actual.JSDOM>["window"];
          constructor(...args: ConstructorParameters<typeof actual.JSDOM>) {
            windows++;
            this.window = new actual.JSDOM(...args).window;
          }
        },
      }));
      const { markTemplateChips } =
        require("~/lib/wiki-os/templates/chip-markers") as typeof import("~/lib/wiki-os/templates/chip-markers");

      markTemplateChips("<p>No chips here.</p>");
    });

    expect(windows).toBe(0);
  });

  const withGc = typeof global.gc === "function" ? it : it.skip;
  withGc("grows the heap by less than 20 MB over 2,000 calls (run with node --expose-gc)", () => {
    const { markTemplateChips } =
      require("~/lib/wiki-os/templates/chip-markers") as typeof import("~/lib/wiki-os/templates/chip-markers");
    markTemplateChips(PAGE); // the one window is part of the baseline
    global.gc!();
    const before = process.memoryUsage().heapUsed;

    for (let n = 0; n < 2_000; n++) markTemplateChips(PAGE);
    global.gc!();

    const grownMb = (process.memoryUsage().heapUsed - before) / (1024 * 1024);
    expect(grownMb).toBeLessThan(20);
  });
});
