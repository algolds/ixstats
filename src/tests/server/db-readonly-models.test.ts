/** @jest-environment node */
import { readFileSync } from "node:fs";

it("keeps the Phase 4 card models writable in read-only development mode", () => {
  const source = readFileSync("src/server/db.ts", "utf8");
  for (const model of [
    "CardListing",
    "CardDustBalance",
    "CardDustEvent",
    "CardMarketPrice",
    "CardNotificationMute",
    "CardInscriptionReport",
    "CardExperienceEvent",
    "CardValueHistory",
  ]) {
    expect(source).toMatch(new RegExp(`\\b${model}\\b`));
  }
});
