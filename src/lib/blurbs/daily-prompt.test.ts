import { pickDailyPrompt } from "./daily-prompt";

const prompts = [{ id: "c" }, { id: "a" }, { id: "b" }];

describe("pickDailyPrompt", () => {
  it("returns null with no prompts", () => {
    expect(pickDailyPrompt([], new Date())).toBeNull();
  });

  it("keeps one prompt for the whole UTC day, whatever the input order", () => {
    const morning = pickDailyPrompt(prompts, new Date("2026-11-13T00:00:01Z"));
    const night = pickDailyPrompt([...prompts].reverse(), new Date("2026-11-13T23:59:59Z"));
    expect(morning).toEqual(night);
  });

  it("moves to the next prompt each day and wraps around", () => {
    const days = ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"].map(
      (d) => pickDailyPrompt(prompts, new Date(`${d}T12:00:00Z`))!.id
    );
    expect(new Set(days.slice(0, 3)).size).toBe(3);
    expect(days[3]).toBe(days[0]);
  });
});
