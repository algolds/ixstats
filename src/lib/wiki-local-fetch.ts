/**
 * wiki-local-fetch.ts — Local MediaWiki API routing via Node https.Agent.
 *
 * In production, ixwiki.com runs on the same server. Instead of going through
 * Cloudflare (50-70ms), we connect to localhost via HTTPS with proper SNI
 * for ~20ms warm requests (3-4x speedup). A persistent https.Agent with
 * keep-alive amortises the TLS handshake across all requests.
 *
 * Falls back to the public URL if the local connection fails.
 */

import https from "node:https";

// Persistent HTTPS agent for localhost connections — reuses TCP+TLS sessions
let _localAgent: https.Agent | null = null;

function getLocalAgent(): https.Agent {
  if (!_localAgent) {
    _localAgent = new https.Agent({
      rejectUnauthorized: false, // Cert is for ixwiki.com, not 127.0.0.1
      servername: "ixwiki.com", // SNI must match nginx server_name
      keepAlive: true,
      maxSockets: 6, // Match IxnayWikiService's maxConcurrent
      keepAliveMsecs: 60_000,
    });
  }
  return _localAgent;
}

/**
 * Make a local HTTP request using Node's https module.
 * Returns a standard Response-like object.
 */
function localHttpGet(path: string, timeoutMs: number): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: "127.0.0.1",
        port: 443,
        path,
        agent: getLocalAgent(),
        headers: {
          "User-Agent": "IxStats-Builder",
          Host: "ixwiki.com", // nginx routes based on Host header
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 500, text: data }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Local wiki fetch timeout"));
    });
    req.on("error", reject);
  });
}

/**
 * Fetch from ixwiki's MediaWiki API via localhost in production.
 * In development, falls through to the public URL.
 *
 * @param path  URL path including query string, e.g. "/api.php?action=query&..."
 * @param timeoutMs  Request timeout (default 5000ms)
 * @returns Standard Response object
 */
export async function localWikiFetch(path: string, timeoutMs = 5000): Promise<Response> {
  // Only use local routing in production (same server as MediaWiki)
  if (process.env.NODE_ENV !== "production") {
    return fetch(`https://ixwiki.com${path}`, {
      headers: { "User-Agent": "IxStats-Builder" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  try {
    const result = await localHttpGet(path, timeoutMs);
    return new Response(result.text, { status: result.status });
  } catch {
    // Fallback to public URL if local connection fails
    return fetch(`https://ixwiki.com${path}`, {
      headers: { "User-Agent": "IxStats-Builder" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  }
}
