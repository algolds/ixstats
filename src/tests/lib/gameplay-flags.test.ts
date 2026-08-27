import { describe, it, expect, afterEach } from "@jest/globals";
import { getGameplayFlags } from "~/lib/gameplay-flags";

describe("GAMEPLAY_FLAGS", () => {
  const ENV = process.env;

  afterEach(() => {
    process.env = ENV;
  });

  it("defaults all issue loops OFF (narrative mode)", () => {
    process.env = { ...ENV };
    delete process.env.ISSUES_AUTO_GENERATE;
    delete process.env.ISSUES_ENFORCE_DEADLINES;
    delete process.env.ISSUES_AWARD_CREDITS;
    const flags = getGameplayFlags();
    expect(flags.issuesAutoGenerate).toBe(true);
    expect(flags.issuesEnforceDeadlines).toBe(false);
    expect(flags.issuesAwardCredits).toBe(false);
  });

  it("opts into the classic loop when env flags are set", () => {
    process.env = {
      ...ENV,
      ISSUES_AUTO_GENERATE: "1",
      ISSUES_AWARD_CREDITS: "true",
    };
    const flags = getGameplayFlags();
    expect(flags.issuesAutoGenerate).toBe(true);
    expect(flags.issuesAwardCredits).toBe(true);
  });

  it("treats empty env values as defaults", () => {
    process.env = {
      ...ENV,
      ISSUES_AUTO_GENERATE: "",
      ISSUES_ENFORCE_DEADLINES: "",
      ISSUES_AWARD_CREDITS: "",
    };
    const flags = getGameplayFlags();
    expect(flags.issuesAutoGenerate).toBe(true);
    expect(flags.issuesEnforceDeadlines).toBe(false);
    expect(flags.issuesAwardCredits).toBe(false);
  });
});
