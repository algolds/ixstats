import { describe, it, expect, afterEach } from "@jest/globals";

describe("GAMEPLAY_FLAGS", () => {
  const ENV = process.env;

  afterEach(() => {
    process.env = ENV;
  });

  it("defaults all issue loops OFF (narrative mode)", () => {
    jest.isolateModules(() => {
      process.env = { ...ENV };
      delete process.env.ISSUES_AUTO_GENERATE;
      delete process.env.ISSUES_ENFORCE_DEADLINES;
      delete process.env.ISSUES_AWARD_CREDITS;
      const { GAMEPLAY_FLAGS } = require("~/lib/gameplay-flags");
      expect(GAMEPLAY_FLAGS.issuesAutoGenerate).toBe(true);
      expect(GAMEPLAY_FLAGS.issuesEnforceDeadlines).toBe(false);
      expect(GAMEPLAY_FLAGS.issuesAwardCredits).toBe(false);
    });
  });

  it("opts into the classic loop when env flags are set", () => {
    jest.isolateModules(() => {
      process.env = {
        ...ENV,
        ISSUES_AUTO_GENERATE: "1",
        ISSUES_AWARD_CREDITS: "true",
      };
      const { GAMEPLAY_FLAGS } = require("~/lib/gameplay-flags");
      expect(GAMEPLAY_FLAGS.issuesAutoGenerate).toBe(true);
      expect(GAMEPLAY_FLAGS.issuesAwardCredits).toBe(true);
    });
  });

  it("treats empty env values as defaults", () => {
    jest.isolateModules(() => {
      process.env = {
        ...ENV,
        ISSUES_AUTO_GENERATE: "",
        ISSUES_ENFORCE_DEADLINES: "",
        ISSUES_AWARD_CREDITS: "",
      };
      const { GAMEPLAY_FLAGS } = require("~/lib/gameplay-flags");
      expect(GAMEPLAY_FLAGS.issuesAutoGenerate).toBe(true);
      expect(GAMEPLAY_FLAGS.issuesEnforceDeadlines).toBe(false);
      expect(GAMEPLAY_FLAGS.issuesAwardCredits).toBe(false);
    });
  });
});
