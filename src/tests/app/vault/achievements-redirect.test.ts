/** @jest-environment node */
/**
 * Achievements live at /vault/achievements. The old /achievements address forwards there, keeping the query so a
 * saved notification link (?a=<key>) still opens its achievement.
 */
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

import { describe, expect, it } from "@jest/globals";
import AchievementsRedirectPage from "~/app/achievements/page";

describe("/achievements redirect", () => {
  it("keeps the achievement key", async () => {
    await expect(
      AchievementsRedirectPage({ searchParams: Promise.resolve({ a: "econ-first-million" }) })
    ).rejects.toThrow("redirect:/vault/achievements?a=econ-first-million");
  });

  it("keeps the tab", async () => {
    await expect(
      AchievementsRedirectPage({ searchParams: Promise.resolve({ tab: "leaderboard" }) })
    ).rejects.toThrow("redirect:/vault/achievements?tab=leaderboard");
  });

  it("goes bare when there is no query", async () => {
    await expect(AchievementsRedirectPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/vault/achievements"
    );
  });
});
