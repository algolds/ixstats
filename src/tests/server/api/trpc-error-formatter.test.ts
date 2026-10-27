/** @jest-environment node */
/**
 * The tRPC error formatter (src/server/api/trpc/init.ts) and the wiki guard's typed error: a procedure that throws
 * `WikiUnavailableError` answers HTTP 503 with `data.code` SERVICE_UNAVAILABLE (429 / TOO_MANY_REQUESTS when busy),
 * and in production the client reads the message and `{ wiki, reason }`, never a stack or the upstream URL.
 */
jest.mock("~/lib/logging", () => ({
  __esModule: true,
  ErrorLogger: { logAPIError: jest.fn(async () => undefined) },
}));

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

type InitModule = typeof import("~/server/api/trpc/init");
type GuardModule = typeof import("~/lib/wiki-os/upstream-guard");

const env = process.env as Record<string, string | undefined>;
const savedNodeEnv = env.NODE_ENV;

afterEach(() => {
  env.NODE_ENV = savedNodeEnv;
});

/** The formatter and the error class from one fresh module registry, loaded under `nodeEnv`. */
function load(nodeEnv: string): { init: InitModule; guard: GuardModule } {
  env.NODE_ENV = nodeEnv;
  let loaded: { init: InitModule; guard: GuardModule } | undefined;
  jest.isolateModules(() => {
    loaded = {
      init: jest.requireActual<InitModule>("~/server/api/trpc/init"),
      guard: jest.requireActual<GuardModule>("~/lib/wiki-os/upstream-guard"),
    };
  });
  return loaded!;
}

interface ErrorBody {
  error: {
    json: {
      message: string;
      data: { code: string; httpStatus: number; context?: Record<string, string>; stack?: string };
    };
  };
}

async function call(nodeEnv: string, reason: "unreachable" | "circuit-open" | "busy") {
  const { init, guard } = load(nodeEnv);
  const router = init.createTRPCRouter({
    read: init.t.procedure.query(() => {
      throw new guard.WikiUnavailableError("IIWiki", reason);
    }),
  });
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request("http://localhost/api/trpc/read"),
    router,
    createContext: async () => ({}) as never,
  });
  return { status: response.status, body: (await response.json()) as ErrorBody };
}

describe("the formatter and WikiUnavailableError", () => {
  it.each([
    ["unreachable", 503, "SERVICE_UNAVAILABLE", "IIWiki could not be reached just now."],
    ["circuit-open", 503, "SERVICE_UNAVAILABLE", "IIWiki could not be reached just now."],
    ["busy", 429, "TOO_MANY_REQUESTS", "IIWiki is busy; try again shortly."],
  ] as const)("%s answers %i with %s", async (reason, httpStatus, code, message) => {
    const { status, body } = await call("production", reason);
    expect(status).toBe(httpStatus);
    expect(body.error.json.message).toBe(message);
    expect(body.error.json.data.code).toBe(code);
    expect(body.error.json.data.httpStatus).toBe(httpStatus);
    expect(body.error.json.data.context).toEqual({ wiki: "IIWiki", reason });
  });

  it("in production the client sees no stack and nothing beyond the message, the codes and the context", async () => {
    const { body } = await call("production", "unreachable");
    expect(body.error.json.data.stack).toBeUndefined();
    expect(Object.keys(body.error.json.data).sort()).toEqual(
      ["code", "context", "httpStatus", "path"].sort()
    );
    expect(JSON.stringify(body)).not.toMatch(/https?:|api\.php/);
  });
});
