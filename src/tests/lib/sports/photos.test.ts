/** @jest-environment node */
/**
 * A player's photo is used straight as an `src`, so under production's base path both an uploaded photo and the
 * sportyblocks fallback carry it, and an absolute photo URL is left alone.
 */
import { getPlayerPhotoUrl } from "~/lib/sports/photos";

const BASE = "/projects/ixstates";
const saved = { ...process.env };

beforeEach(() => {
  process.env = { ...saved, NEXT_PUBLIC_BASE_PATH: BASE };
  delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
});

afterAll(() => {
  process.env = saved;
});

describe("getPlayerPhotoUrl", () => {
  it("gives an uploaded photo the base path", () => {
    expect(getPlayerPhotoUrl({ imageUrl: "/images/uploads/p.png" })).toBe(
      `${BASE}/images/uploads/p.png`
    );
  });

  it("leaves an absolute photo alone", () => {
    expect(getPlayerPhotoUrl({ imageUrl: "https://cdn.example/p.png" })).toBe(
      "https://cdn.example/p.png"
    );
  });

  it("gives the sportyblocks fallback the base path", () => {
    expect(getPlayerPhotoUrl({})).toBe(`${BASE}/images/sportyblocks/player-1.png`);
    expect(getPlayerPhotoUrl({ id: "p1", firstName: "Kai", lastName: "Ito" })).toMatch(
      new RegExp(`^${BASE}/images/sportyblocks/player-(1|3|5|7|9|11|13)\\.png$`)
    );
  });
});
