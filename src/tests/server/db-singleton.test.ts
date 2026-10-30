/** @jest-environment node */
/**
 * One Prisma client per process in every environment: `~/server/db` keeps its client on `globalThis`, so a second
 * module graph (the proxy entry beside the app) reuses it instead of opening another pool. Production too.
 */
class FakePrismaClient {
  $extends(): this {
    return this;
  }
}

const holder = globalThis as unknown as { prisma?: unknown };

function loadDb(nodeEnv: string): unknown {
  let db: unknown;
  jest.isolateModules(() => {
    jest.doMock("@prisma/client", () => ({ __esModule: true, PrismaClient: FakePrismaClient }));
    jest.doMock("~/env", () => ({ __esModule: true, env: { NODE_ENV: nodeEnv } }));
    ({ db } = jest.requireActual<{ db: unknown }>("~/server/db"));
  });
  return db;
}

afterEach(() => {
  delete holder.prisma;
});

describe("the Prisma singleton", () => {
  it.each(["production", "development", "test"])(
    "is kept on globalThis and reused by a second module graph in %s",
    (nodeEnv) => {
      const first = loadDb(nodeEnv);

      expect(holder.prisma).toBe(first);
      expect(loadDb(nodeEnv)).toBe(first);
    }
  );
});
