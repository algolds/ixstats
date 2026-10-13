import { amountGap, compact, percent, shareGap } from "~/lib/worldgen/calibration-format";

describe("worldgen/calibration-format", () => {
  it("words shares as percentages", () => {
    expect(percent(0.2203)).toBe("22.0%");
    expect(percent(0)).toBe("0.0%");
    expect(percent(1)).toBe("100.0%");
  });

  it("shortens counts and sizes", () => {
    expect(compact(83)).toBe("83");
    expect(compact(272_569)).toBe("273k");
    expect(compact(1_443_534)).toBe("1.44M");
    expect(compact(668_684)).toBe("669k");
  });

  it("signs a share gap in points and leaves a zero gap unsigned", () => {
    expect(shareGap(0.312, 0.22)).toBe("+9.2 pts");
    expect(shareGap(0.1, 0.25)).toBe("-15.0 pts");
    expect(shareGap(0.3, 0.3)).toBe("0.0 pts");
    expect(shareGap(0.3001, 0.3)).toBe("0.0 pts");
  });

  it("signs an amount gap", () => {
    expect(amountGap(130, 183)).toBe("-53");
    expect(amountGap(706_665, 272_569)).toBe("+434k");
    expect(amountGap(5, 5)).toBe("0");
    expect(amountGap(5.2, 5)).toBe("0");
  });
});
