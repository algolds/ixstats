import { groupAchievements } from "~/lib/feed/group-achievements";
import { getActivityLabel } from "~/lib/feed/activity-labels";

const BASE_MS = new Date("2026-11-11T16:00:00.000Z").getTime();
const minsAgo = (mins: number) => new Date(BASE_MS - mins * 60_000);

function unlock(id: string, countryName: string, achievementName: string, mins: number, key = id) {
  return {
    id,
    type: "achievement",
    category: "game",
    source: "activity",
    user: { id: `u-${countryName}`, name: `@${countryName.toLowerCase()}`, countryName },
    content: {
      title: `${countryName} Unlocks Achievement: ${achievementName}`,
      description: `Unlocked ${achievementName}`,
      metadata: {
        eventType: "achievement_unlocked",
        achievementName,
        achievementKey: key,
      },
    },
    timestamp: minsAgo(mins),
  };
}

describe("getActivityLabel for achievements", () => {
  it.each([
    "Trade Magnate",
    "Diplomatic Corps",
    "City Planner",
    "Map Claimer",
    "Defense Architect",
    "Government Reformer",
  ])("labels an achievement containing domain keywords (%s) as Achievement", (name) => {
    const item = unlock("a1", "Caphiria", name, 1);
    expect(getActivityLabel(item).label).toBe("Achievement");
  });
});

describe("groupAchievements", () => {
  it("folds achievement bursts within 2 hours across nations and intervening posts into the newest slot", () => {
    const post = {
      id: "post-1",
      source: "thinkpages",
      content: { title: "Hello world" },
      timestamp: minsAgo(20),
    };
    const items = [
      unlock("a1", "Caphiria", "Trade Magnate", 5),
      unlock("a2", "Caphiria", "Diplomatic Corps", 10),
      post,
      unlock("a3", "Urcea", "City Planner", 45),
      unlock("a4", "Castadilla", "Map Claimer", 90),
    ];

    const out = groupAchievements(items);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      type: "achievement",
      _grouped: true,
      _isAchievementGroup: true,
      _editCount: 4,
      _editors: ["Caphiria", "Urcea", "Castadilla"],
      content: { title: "4 achievements unlocked" },
    });
    expect(out[0]?._subEdits?.map((s) => s.id)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(out[1]).toBe(post);
  });

  it("merges adjacent back-to-back achievement unlocks beyond 2 hours within a day when nothing sits between them", () => {
    const post = {
      id: "post-2",
      source: "thinkpages",
      content: { title: "Earlier post" },
      timestamp: minsAgo(600),
    };
    const items = [
      unlock("a1", "Caphiria", "First Step", 10),
      unlock("a2", "Urcea", "Second Step", 240),
      unlock("a3", "Castadilla", "Third Step", 420),
      post,
    ];

    const out = groupAchievements(items);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      _grouped: true,
      _isAchievementGroup: true,
      _editCount: 3,
      _editors: ["Caphiria", "Urcea", "Castadilla"],
      content: { title: "3 achievements unlocked" },
    });
    expect(out[1]).toBe(post);
  });

  it("keeps achievements in separate time windows apart when real posts sit between them, and leaves singletons ungrouped", () => {
    const singleNew = unlock("a1", "Caphiria", "First Step", 10);
    const post = {
      id: "post-1",
      source: "thinkpages",
      content: { title: "Midday dispatch" },
      timestamp: minsAgo(180),
    };
    const older1 = unlock("a2", "Urcea", "Veteran", 300);
    const older2 = unlock("a3", "Urcea", "Elder", 310);

    const out = groupAchievements([singleNew, post, older1, older2]);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(singleNew);
    expect((out[0] as { _grouped?: boolean })._grouped).toBeUndefined();
    expect(out[1]).toBe(post);
    expect(out[2]).toMatchObject({
      _grouped: true,
      _editCount: 2,
      _editors: ["Urcea"],
      content: { title: "2 achievements unlocked" },
    });
  });
});
