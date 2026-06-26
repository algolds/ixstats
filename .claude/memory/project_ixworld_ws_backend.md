---
name: project_ixworld_ws_backend
description: WebSocket backend split for the ixworld-only live preview (realtime via a dedicated WS process + nginx proxy)
metadata:
  type: project
---

Live preview is served ONLY by the ixworld deployment (PM2 "ixworld", Next standalone `server.js`, :3002, maps.ixwiki.com). That build has NO Socket.IO server, so realtime failed. Solution (June 2026):

- **tRPC + SSE already work on ixworld** (same-origin App Router routes) — they did NOT need a backend. The big 520s were collateral: the editor batched a giant `geoAdmin.sampleAreaSqKm` GET (whole country polygon in URL) → HTTP2/520 took down the whole tRPC batch. Fixed by computing area client-side (`SubdivisionPropertyForm.tsx` uses `geometryAreaSqKm` from `~/lib/geo-math`).
- **Only WebSocket needed a backend.** WS client URLs are hardcoded same-origin (not env-redirectable). So: dedicated **`ws-backend.mjs`** (project root) runs ONLY the WS servers (no Next, no cron) as PM2 app **`ixstats-ws`** on :3551. nginx on maps.ixwiki.com proxies `/ws/thinkpages`, `/socket.io`, `/api/market-ws` → 127.0.0.1:3551 (upgrade headers, 3600s timeouts); everything else still → ixworld :3002.
- **GOTCHA:** the WS modules use `import "server-only"` which throws under bun. Fix: run with `bun --conditions react-server` (resolves server-only → its no-op `empty.js`). Set via PM2 `interpreter_args: '--conditions react-server'`.
- **Do NOT run full `server.mjs`** as the backend — it would revive its inline cron and double-pay against the separate `ixstats-cron` process. WS-only backend avoids that.
- nginx config: `/etc/nginx/sites-enabled/maps.ixwiki.com` (WS location blocks before `location /`). Backups in `/root/nginx-backups/`. Also removed a stale `maps.ixwiki.com.bak` from sites-enabled (nginx loads every file there → duplicate server block / conflicting-name warnings).

**Open infra issue:** `ixworld` PM2 process has high restart counts (~53), likely OOM under full-app load — the real cause of intermittent 520s on heavy geo queries. Not yet addressed. Also a leftover `PerfTest Country …` (perf-test seed, not `isDemo`) survived the live-preview reset — clean before launch if unwanted.
