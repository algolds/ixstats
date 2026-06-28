import { ComponentType } from "@prisma/client";
import { deriveBrokers } from "../lib/statecraft-power-brokers";

describe("Statecraft Power Brokers Derivation", () => {
  it("should lock all brokers when no components match", () => {
    const active = deriveBrokers([], {});
    active.forEach((b) => {
      expect(b.unlocked).toBe(false);
      expect(b.satisfied).toBe(false);
    });
  });

  it("should unlock Technocrats but keep them unsatisfied when spend is low", () => {
    const components = [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES];
    const spend = { "Science&Tech": 5.0, Education: 5.0 }; // 10% total, min 15%
    const brokers = deriveBrokers(components, spend);
    const tech = brokers.find((b) => b.id === "technocrats");
    expect(tech?.unlocked).toBe(true);
    expect(tech?.satisfied).toBe(false);
    expect(tech?.gapPercent).toBe(5.0);
  });

  it("should satisfy Technocrats when spend meets the threshold", () => {
    const components = [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES];
    const spend = { "Science&Tech": 10.0, Education: 6.0 }; // 16% total
    const brokers = deriveBrokers(components, spend);
    const tech = brokers.find((b) => b.id === "technocrats");
    expect(tech?.unlocked).toBe(true);
    expect(tech?.satisfied).toBe(true);
    expect(tech?.gapPercent).toBe(0.0);
  });

  it("should support fallback Traditional unlock for the Clergy", () => {
    const components = [ComponentType.TRADITIONAL_LEGITIMACY];
    const spend = { Culture: 20.0 };
    const brokers = deriveBrokers(components, spend);
    const clergy = brokers.find((b) => b.id === "clergy");
    expect(clergy?.unlocked).toBe(true);
    expect(clergy?.satisfied).toBe(true);
  });
});
