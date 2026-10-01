import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { readCacheResponseMeta } from "~/lib/wiki-os/http-cache";

export const runtime = "nodejs";

// Trigger compilation rebuild
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
    req,
  });
};

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    // An anonymous read of an article or the Main Page may sit in the CDN for a few seconds
    responseMeta: readCacheResponseMeta(req),
    onError:
      env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
