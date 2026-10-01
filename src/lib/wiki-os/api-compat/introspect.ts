/**
 * introspect.ts — what a module reads, found by running it (plan 410).
 *
 * `action=paraminfo` must list every parameter of every module, and a hand-kept table would drift
 * from the code. Instead a module is run over EMPTY parameters that record each read (`params.ts`,
 * `ApiParams.introspect`), with dependencies that answer anything and never touch a database. A
 * module reads its parameters before it acts on them, so by the time it fails on the missing
 * request (or finishes on empty data) the record holds all of them.
 */

import { SizeBudget } from "./budget";
import { ApiParams, ParamRecord, type ParamDefinition } from "./params";
import type { ApiContext, ApiDeps, ApiSession } from "./types";

/** An object that is any value a module might ask a dependency for: callable, with any property, empty when iterated. */
function ghost(): object {
  const target = function () {
    return undefined;
  };
  const handler: ProxyHandler<object> = {
    get(_target, key) {
      if (key === "then") return undefined; // not a promise: `await ghost` is ghost itself
      if (key === Symbol.iterator) return function* () {};
      if (key === Symbol.toPrimitive) return () => 0;
      if (key === "length") return 0;
      // An element of an empty list: nothing there (a loop that waits for "the next row" ends).
      if (typeof key === "string" && /^\d+$/.test(key)) return undefined;
      return proxy;
    },
    apply: () => proxy,
  };
  const proxy: object = new Proxy(target, handler);
  return proxy;
}

const anyValue = ghost() as never;

function ghostDeps(): ApiDeps {
  const unreached = new Proxy({}, { get: () => anyValue });
  return {
    auth: unreached as never,
    loadPermissions: async () => {
      throw new Error("introspection reads no permissions");
    },
    rateLimit: async () => ({ success: true, resetAt: new Date(0) }),
    store: unreached as never,
    services: unreached as never,
    search: async () => ({ hits: [], total: 0 }),
    siteUrl: "https://introspection.invalid",
    now: () => new Date(0),
  };
}

/** A caller that passes every check a module makes before it reads its parameters (a write needs a bot session). */
function introspectionSession(): ApiSession {
  return {
    kind: "bot",
    name: "Introspection",
    userId: 1,
    ctx: { auth: null, user: null },
    permissions: { groups: [], rights: new Set(), block: null, verifiedWikiUsername: null },
    sessionId: null,
    grants: null,
  };
}

/** The context a module is introspected in: empty parameters that record, ghost dependencies. */
export function introspectionContext(record: ParamRecord): ApiContext {
  return {
    params: ApiParams.introspect(record),
    version: 2,
    method: "POST",
    session: introspectionSession(),
    deps: ghostDeps(),
    now: new Date(0),
    loginNonce: undefined,
    cookiePath: "/",
    clientKey: "introspection",
    setCookies: [],
    highLimits: false,
    budget: new SizeBudget(),
    files: new Map(),
  };
}

export interface IntrospectedParams {
  /** The prefix the module reads its parameters under (empty when it has none). */
  prefix: string;
  parameters: ParamDefinition[];
}

/**
 * The parameters `run` reads. Whatever the module does with empty parameters (finish, or fail on
 * the missing request) is ignored: only its reads count.
 */
export async function introspectParams(
  run: (rc: ApiContext) => unknown
): Promise<IntrospectedParams> {
  const record = new ParamRecord();
  try {
    await run(introspectionContext(record));
  } catch {
    // A module that needs a real request stops somewhere after its reads.
  }
  return { prefix: [...record.prefixes][0] ?? "", parameters: [...record.definitions.values()] };
}
