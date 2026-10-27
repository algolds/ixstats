/**
 * Next.js Instrumentation Hook: runs once when the server starts.
 *
 * register() runs in BOTH the Node.js and Edge runtimes. Everything lives in
 * `instrumentation-node.ts`, imported only inside the NEXT_RUNTIME check: that is the pattern
 * Turbopack reliably drops from the Edge bundle (an early return is not, and pulls in
 * `./server/db`, warning about process.memoryUsage).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
