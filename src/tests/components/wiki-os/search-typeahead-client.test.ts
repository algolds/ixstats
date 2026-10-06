/** @jest-environment node */
/**
 * Plan 413 (item 2): the search boxes ask the title typeahead, from 2 characters, one request per
 * 150 ms pause, and keep an answer for 60 s.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe.each([
  ["HeroSpotlightSearch", "src/components/wiki-os/reader/hero/HeroSpotlightSearch.tsx"],
])("%s", (_name, file) => {
  const source = read(file);

  it("uses the title typeahead, not the full-text search", () => {
    expect(source).toContain("api.wikios.typeahead.useQuery");
    expect(source).not.toContain("advancedSearch");
  });

  it("debounces 150 ms, starts at 2 characters and stales after 60 s", () => {
    expect(source).toMatch(/\}, 150\)|, 150\);|useDebounce\(.*, 150\)/);
    expect(source).toMatch(/length >= (2|MIN_QUERY_LENGTH)/);
    expect(source).toContain("staleTime: 60_000");
  });
});

describe("WikiSearchDropdown (full-text results)", () => {
  const source = read("src/components/halo/plugins/wiki/components/WikiSearchDropdown.tsx");

  it("debounces its full-text query and shows the match ranges", () => {
    expect(source).toContain("150");
    expect(source).toContain("staleTime: 60_000");
    expect(source).toContain("<HighlightedSnippet");
  });
});
