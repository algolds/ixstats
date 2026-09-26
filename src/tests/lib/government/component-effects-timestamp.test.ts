/**
 * @jest-environment node
 */
import { ComponentType } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { applyGovernmentComponentEffects } from "~/lib/government/component-effects";

interface CreatedEffect {
  ixTimeTimestamp: Date;
  description: string;
}

describe("applyGovernmentComponentEffects timestamps (plan 329)", () => {
  const FIXED_IXTIME_MS = Date.UTC(2042, 0, 1);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("dates every effect at IxTime.getCurrentIxTime() milliseconds (no ×1000)", async () => {
    jest.spyOn(IxTime, "getCurrentIxTime").mockReturnValue(FIXED_IXTIME_MS);

    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const db = {
      storytellerEffect: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany,
      },
      governmentStructure: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
    };

    const result = await applyGovernmentComponentEffects(db as never, "country_1", {
      activeComponents: [
        { componentType: ComponentType.PROFESSIONAL_BUREAUCRACY, effectivenessScore: 70 },
        { componentType: ComponentType.DEMOCRATIC_PROCESS, effectivenessScore: 60 },
      ],
      allocations: [],
    });

    expect(result.effectsCreated).toBeGreaterThan(0);
    expect(createMany).toHaveBeenCalledTimes(1);

    const calls = createMany.mock.calls as Array<[{ data: CreatedEffect[] }]>;
    const data = calls[0]![0].data;
    expect(data).toHaveLength(result.effectsCreated);
    for (const effect of data) {
      expect(effect.ixTimeTimestamp.getTime()).toBe(FIXED_IXTIME_MS);
      expect(effect.ixTimeTimestamp.getUTCFullYear()).toBeLessThan(3000);
    }
  });
});
