#!/usr/bin/env tsx
import { appRouter, createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

type Result = {
  path: string;
  type: "query" | "mutation";
  status: "PASS" | "FAIL" | "SKIP";
  ms: number;
  error?: string;
};

async function main() {
  const headers = new Headers();
  const tenantPrefix = process.env.TEST_TENANT_PREFIX || "__e2e__";
  headers.set("x-ratelimit-identifier", `audit-${tenantPrefix}`);

  const ctx = await createTRPCContext({ headers });
  const caller = createCaller(ctx);

  const results: Result[] = [];

  // Define per-endpoint minimal inputs where needed
  const fixtures: Record<string, unknown> = {
    "countries.getAll": {},
  };

  // Discover endpoints by introspecting router object shape
  function listEndpoints(
    router: any,
    prefix: string[] = []
  ): { path: string; fn: any; type: "query" | "mutation" }[] {
    const out: { path: string; fn: any; type: "query" | "mutation" }[] = [];
    for (const key of Object.keys(router)) {
      const val = (router as any)[key];
      if (typeof val === "function") {
        // unknown - treat as query
        out.push({ path: [...prefix, key].join("."), fn: val, type: "query" });
      } else if (val && typeof val === "object") {
        // Try standard .query/.mutate signatures (tRPC caller exposes as functions)
        if (typeof val.query === "function" || typeof val.mutate === "function") {
          if (typeof val.query === "function")
            out.push({ path: [...prefix, key].join("."), fn: val, type: "query" });
          if (typeof val.mutate === "function")
            out.push({ path: [...prefix, key].join("."), fn: val, type: "mutation" });
        } else {
          out.push(...listEndpoints(val, [...prefix, key]));
        }
      }
    }
    return out;
  }

  const endpoints = listEndpoints(caller);

  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const input = fixtures[ep.path];
      if (ep.type === "mutation" && process.env.ALLOW_E2E_MUTATIONS !== "true") {
        results.push({ path: ep.path, type: ep.type, status: "SKIP", ms: 0 });
        continue;
      }
      // @ts-expect-error dynamic call
      const res = input ? await ep.fn(input) : await ep.fn();
      const ms = Date.now() - start;
      results.push({ path: ep.path, type: ep.type, status: "PASS", ms });
    } catch (err) {
      const ms = Date.now() - start;
      const message = (err as Error).message || "";
      const treatAuthAsSkip = process.env.INVOKE_TREAT_AUTH_ERRORS_AS_SKIP !== "false";
      if (treatAuthAsSkip && /(UNAUTHORIZED|FORBIDDEN|RATE_LIMITED)/i.test(message)) {
        results.push({ path: ep.path, type: ep.type, status: "SKIP", ms, error: message });
      } else {
        results.push({ path: ep.path, type: ep.type, status: "FAIL", ms, error: message });
      }
    }
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`\nTRPC Invocation Summary: PASS=${pass} FAIL=${fail} SKIP=${skip}`);

  const failOnErrors = process.env.INVOKE_FAIL_ON_ERRORS !== "false";
  if (fail > 0 && failOnErrors) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
