import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  formatCooldownTime,
} from "~/components/mycountry/shell/DirectiveStatusLine";
import { IxTime } from "~/lib/ixtime";

describe("CooldownTimer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2040-01-01T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });
  it("reads the server's IxTime cooldown, not wall time", () => {
    // getStatus returns cooldownUntil in IxTime ms; a week out must read as days, not years.
    const weekOut = IxTime.getCurrentIxTime() + 7 * 24 * 60 * 60 * 1000;
    expect(formatCooldownTime(weekOut)).toBe("7d 0h 0m");
  });
});
