/**
 * Caps the open map-update streams (the route is public, and each stream holds a socket, a bus subscription and a
 * keep-alive timer for as long as the client stays): per process, and per client IP when the request carries one
 * (resolveRateLimitIdentifier: CF-Connecting-IP or nginx's X-Real-IP, never X-Forwarded-For).
 */
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";

export const MAX_STREAMS = 500;
export const MAX_STREAMS_PER_CLIENT = 6;

export type StreamSlot =
  | { ok: true; release: () => void }
  | { ok: false; status: 429 | 503; error: string };

export function createStreamLimiter(max = MAX_STREAMS, maxPerClient = MAX_STREAMS_PER_CLIENT) {
  let open = 0;
  const perClient = new Map<string, number>();

  return {
    acquire(headers: Headers): StreamSlot {
      const client = resolveRateLimitIdentifier(headers, null);
      // Without an IP every client shares "anonymous": only the process cap applies to them.
      const keyed = client !== "anonymous";
      if (open >= max) return { ok: false, status: 503, error: "Too many open map update streams" };
      const mine = keyed ? (perClient.get(client) ?? 0) : 0;
      if (keyed && mine >= maxPerClient) {
        return { ok: false, status: 429, error: "Too many open map update streams from this client" };
      }
      open++;
      if (keyed) perClient.set(client, mine + 1);
      let released = false;
      return {
        ok: true,
        release: () => {
          if (released) return;
          released = true;
          open--;
          if (!keyed) return;
          const left = (perClient.get(client) ?? 1) - 1;
          if (left > 0) perClient.set(client, left);
          else perClient.delete(client);
        },
      };
    },
    get open() {
      return open;
    },
  };
}

/** This process's limiter for /api/sse/map-updates. */
export const mapUpdateStreams = createStreamLimiter();
