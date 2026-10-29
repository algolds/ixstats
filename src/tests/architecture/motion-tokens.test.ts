import fs from "fs";
import path from "path";

import { SPRING_PRESETS } from "~/components/ui/facet/shared/constants";
import {
  REDUCED_MOTION_FADE,
  springGentle,
  springMomentum,
  springSmooth,
  springSnappy,
} from "~/lib/design/motion";

const zeta = (s: { stiffness: number; damping: number }) => s.damping / (2 * Math.sqrt(s.stiffness));

describe("motion tokens", () => {
  it("default springs are critically damped", () => {
    for (const s of [springSnappy, springSmooth]) expect(zeta(s)).toBeGreaterThanOrEqual(0.98);
  });

  it("only momentum and gentle overshoot, a little", () => {
    expect(zeta(springMomentum)).toBeGreaterThan(0.75);
    expect(zeta(springMomentum)).toBeLessThan(0.85);
    expect(zeta(springGentle)).toBeGreaterThan(0.85);
  });

  it("reduce motion stays a tween", () => {
    expect(REDUCED_MOTION_FADE.type).toBe("tween");
  });

  it("CSS mirrors match", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../styles/facet/tokens.css"), "utf8");
    const named = { snappy: springSnappy, smooth: springSmooth, gentle: springGentle, momentum: springMomentum };
    for (const [name, s] of Object.entries(named)) {
      expect(css).toContain(`--spring-${name}-stiffness: ${s.stiffness};`);
      expect(css).toContain(`--spring-${name}-damping: ${s.damping};`);
    }
  });

  it("swipe presets are named springs", () => {
    const named = [springSnappy, springSmooth, springGentle, springMomentum].map(
      (s) => `${s.stiffness}/${s.damping}`
    );
    for (const p of Object.values(SPRING_PRESETS)) expect(named).toContain(`${p.stiffness}/${p.damping}`);
  });
});
