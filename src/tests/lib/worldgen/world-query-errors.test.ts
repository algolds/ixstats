import { isOutrunMessage } from "~/lib/worldgen/worker/world-query-errors";

describe("worldgen/world-query-errors", () => {
  it("tells a request the world outran from a real failure", () => {
    expect(isOutrunMessage("The world changed before the answer came")).toBe(true);
    expect(isOutrunMessage("The world generator was restarted")).toBe(true);
    expect(isOutrunMessage("There is no world to draw")).toBe(true);
    expect(isOutrunMessage("canvas too large")).toBe(false);
  });
});
