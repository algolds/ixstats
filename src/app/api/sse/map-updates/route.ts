/**
 * SSE endpoint for real-time map update broadcasts.
 *
 * Clients connect here and receive `map_data_changed` events whenever
 * any geo mutation succeeds (city, subdivision, POI, story pin, map label, etc.).
 *
 * Usage: new EventSource('/api/sse/map-updates')
 */

import { mapUpdateBus } from "~/lib/map-update-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEEPALIVE_INTERVAL = 15_000; // 15 seconds

export async function GET(request: Request) {
  const signal = request.signal;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`)
      );

      // Subscribe to map update bus
      const unsubscribe = mapUpdateBus.subscribe((event) => {
        if (closed) return;
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`event: map_data_changed\ndata: ${data}\n\n`));
      });

      // Keep-alive: send comment every 15s to prevent connection timeout
      const keepalive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      }, KEEPALIVE_INTERVAL);

      // Cleanup on close
      const cleanup = () => {
        if (closed) return;
        closed = true;
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
