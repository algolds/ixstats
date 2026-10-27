/**
 * SSE endpoint for real-time map update broadcasts.
 *
 * Clients connect here and receive `map_data_changed` events whenever
 * any geo mutation succeeds (city, subdivision, POI, story pin, map label, etc.), each naming the realm it
 * happened in so a map open on another realm can ignore it.
 *
 * Usage: new EventSource('/api/sse/map-updates')
 *
 * Public, so open streams are capped (connection-limit.ts): past the per-process cap a new one gets 503, past the
 * per-client cap 429.
 */

import { mapUpdateBus } from "~/lib/maps/map-update-bus";
import { resolveEventRealm } from "~/server/modules/maps/map-event-realm";
import { db } from "~/server/db";
import { mapUpdateStreams } from "./connection-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEEPALIVE_INTERVAL = 15_000; // 15 seconds

export async function GET(request: Request) {
  const slot = mapUpdateStreams.acquire(request.headers);
  if (!slot.ok) {
    return Response.json(
      { error: slot.error },
      { status: slot.status, headers: { "Retry-After": "30", "Cache-Control": "no-store" } }
    );
  }
  const signal = request.signal;
  const encoder = new TextEncoder();
  let closed = false;
  let cleanup = slot.release;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`)
      );

      // Subscribe to map update bus
      const unsubscribe = mapUpdateBus.subscribe((event) => {
        if (closed) return;
        void resolveEventRealm(db, event)
          .then((resolved) => {
            if (closed) return;
            const data = JSON.stringify(resolved);
            controller.enqueue(encoder.encode(`event: map_data_changed\ndata: ${data}\n\n`));
          })
          .catch((err) => console.error("[map-updates] relay failed:", err));
      });

      // Keep-alive: send comment every 15s to prevent connection timeout
      const keepalive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      }, KEEPALIVE_INTERVAL);

      // Cleanup on close
      cleanup = () => {
        if (closed) return;
        closed = true;
        slot.release();
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Store cleanup on the stream for abort signal
      // Handle client disconnect
      signal.addEventListener("abort", cleanup, { once: true });
      if (signal.aborted) cleanup();
    },
    // The reader went away without an abort (the response was cancelled)
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
