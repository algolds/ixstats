import type { PrismaClient } from "@prisma/client";

export type MockPrismaProxy = {
  [K in keyof PrismaClient]: {
    [M: string]: jest.Mock<any, any>;
  };
} & {
  $transaction: jest.Mock<any, any>;
  [key: string]: any;
};

/**
 * Creates a dynamic typed mock proxy for PrismaClient.
 * Every model and delegate method accessed (e.g. `mockPrisma.country.findUnique`)
 * is auto-instantiated as a `jest.fn()` with mock resolved value support.
 */
export function createMockPrisma(overrides: Record<string, any> = {}): MockPrismaProxy {
  const mockDb: any = {
    $transaction: jest.fn((cb: (tx: any) => any) =>
      typeof cb === "function" ? cb(mockDb) : Promise.all(cb)
    ),
    ...overrides,
  };

  return new Proxy(mockDb, {
    get: (target, prop: string) => {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol" || prop.startsWith("@@") || prop === "then") {
        return undefined;
      }

      target[prop] = new Proxy(
        {},
        {
          get: (modelTarget: Record<string, jest.Mock>, method: string) => {
            if (method in modelTarget) return modelTarget[method];
            if (typeof method === "symbol" || method.startsWith("@@") || method === "then") {
              return undefined;
            }

            modelTarget[method] = jest
              .fn()
              .mockResolvedValue(method === "findMany" ? [] : null);
            return modelTarget[method];
          },
        }
      );

      return target[prop];
    },
  });
}
