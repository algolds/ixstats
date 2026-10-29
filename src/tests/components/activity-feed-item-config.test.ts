import { getActivityTypeConfig } from "~/app/feed/_components/ActivityFeedItem";

describe("getActivityTypeConfig", () => {
  it("returns the known config", () => {
    expect(getActivityTypeConfig("economic").label).toBe("Economic");
  });

  it.each(["military", "crisis", "settings_changed", ""])("falls back for %p", (type) => {
    const config = getActivityTypeConfig(type);
    expect(config.icon).toBeDefined();
    expect(config.label).toBe("Activity");
  });
});
