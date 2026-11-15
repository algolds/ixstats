import { NO_PREFERENCES, withPreference } from "~/lib/messages/preferences";

describe("withPreference", () => {
  it("adds a conversation to one list only", () => {
    const next = withPreference(NO_PREFERENCES, "archived", "c1", true);
    expect(next).toEqual({ muted: [], archived: ["c1"] });
  });

  it("never lists an id twice", () => {
    const once = withPreference(NO_PREFERENCES, "muted", "c1", true);
    expect(withPreference(once, "muted", "c1", true).muted).toEqual(["c1"]);
  });

  it("removes a conversation and keeps the others", () => {
    const prefs = { muted: ["a", "b"], archived: ["a"] };
    expect(withPreference(prefs, "muted", "a", false)).toEqual({ muted: ["b"], archived: ["a"] });
  });

  it("does not change the input", () => {
    const prefs = { muted: ["a"], archived: [] };
    withPreference(prefs, "muted", "b", true);
    expect(prefs.muted).toEqual(["a"]);
  });
});
