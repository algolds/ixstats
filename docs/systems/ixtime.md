# IxTime: Temporal Engine

**Last updated:** August 2026  
**Status:** Production Ready 
**Platform Pillar:** Core Time Engine (Concord Platform Utility)  
**Single Source of Truth:** `src/lib/ixtime/` · `src/stores/ixtime-store.ts` · `src/context/IxTimeContext.tsx`

---

## Executive Summary

**IxTime** is the authoritative, continuous temporal engine powering the simulated world of IxStates. It translates real-world physical time into dilated in-universe game time, governing all time-dependent gameplay systems across the platform:
- **Statecraft & Executive Command**: Issue countdowns, Recon research completion, Directive implementation rollout, and legislative term expirations.
- **Politics & Governance**: Scheduled general elections, cabinet deliberation schedules, and statutory policy cooldowns.
- **Diplomacy & Concord**: Cultural exchange durations, diplomatic mission lifecycles, and bilateral treaty expirations.
- **Economy & Treasury**: Annual budget cycles, inflation adjustments, and passive IxCredit income intervals.
- **MyLeague Sports**: League schedules, live match-clock simulation, qualifying windows, and contract expiries.
- **Halo & UI Ambient Clock**: Dynamic Island live clock telemetry, relative time countdowns, and global game banners.

IxTime features bidirectional mathematical time conversion, cross-service synchronization with the Discord bot daemon (`discord-bot`), and a fine-grained React/Zustand client telemetry loop.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        IXTIME MULTI-TIER SYSTEM ARCHITECTURE                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. DAEMON & SCHEDULER LAYER                                                           │
│    • ixwiki-discord-bot (:3001)       — External timekeeper daemon & Discord commands  │
│    • server.mjs / cron-runner.mjs     — Scheduled election resolutions & passive ticks │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. MASTER TEMPORAL ENGINE (src/lib/ixtime/)                                           │
│    • core.ts (IxTime)                 — Synchronous epoch math & pivot conversions     │
│    • sync.ts (IxTimeSyncManager)      — 15s daemon polling & automated drift correction│
│    • accuracy.ts                      — 11 mathematical verification test suites       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. API & GATEWAY LAYER                                                                │
│    • tRPC Routers                     — api.system.getCurrentIxTime, api.admin.bot.*   │
│    • REST Handlers                    — GET /api/ixtime/current, POST /set-override    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. CLIENT TELEMETRY & STATE (src/stores/ & src/context/)                              │
│    • ixtime-store.ts (Zustand)        — Local linear interpolation without net churn   │
│    • IxTimeContext.tsx (Provider)     — 1,000ms local tick & 30s server reconciliation │
│    • Granular Selector Hooks          — useIxTimeTimestamp(), useIxTimeGameYear(), etc │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. PLATFORM CONSUMERS & STORAGE                                                        │
│    • Halo (Dynamic Island)            — Ambient clock & glance-level countdowns        │
│    • Statecraft & Executive Agenda    — Issue deadlines, recon countdowns, terms       │
│    • MyLeague & Diplomacy             — Match live-clocks, treaty expiries, elections  │
│    • PostgreSQL / PostGIS             — scheduledIxTime, deadlineIxTime (Float / Date) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown
- **`src/lib/ixtime/core.ts`**: Pure mathematical calculations, era pivot transforms, and local memory overrides.
- **`src/lib/ixtime/sync.ts`**: Centralized `IxTimeSyncManager` singleton polling external daemons every 15s with drift correction.
- **`src/lib/ixtime/accuracy.ts`**: Verification suite validating precision, continuity, and leap year handling.
- **`src/stores/ixtime-store.ts`**: Zustand client state running continuous linear time interpolation from local timestamps.
- **`src/context/IxTimeContext.tsx`**: Application-level React provider managing interval ticks and 30s reconciliation syncs.
- **`src/server/api/routers/system.ts`**: Public tRPC endpoint exposing authoritative game time to unauthenticated clients.
- **`src/server/api/routers/admin/bot.ts`**: Administrative tRPC endpoints for manual overrides, pause/resume, and PM2 bot controls.


---

## Temporal Epochs & Mathematical Foundation

IxTime maps real-world UTC timestamps to game-world UTC timestamps through a piece-wise linear dilation function anchored to predefined epochs and historical speed pivots.

> [!NOTE]
> **Canonical Benchmark vs. Engine Configurability**  
> The specific epoch dates (October 2020, January 2028), speed pivot (July 2025 $\equiv$ January 2040), and dilation ratios (4.0x $\to$ 2.0x) detailed below reflect our personal **canonical configuration**, which established the platform's production benchmark.  
> 
> In accordance with the platform's **Realm-First Architecture**, the temporal engine itself is completely modular and parameterized: external **Realms** and custom simulations can define their own real-world start dates, in-game baseline eras (e.g., historical, modern, sci-fi), variable speed dilation factors ($1.0\times$, $2.0\times$, $4.0\times$, etc.), and scheduled speed transitions without modifying the underlying temporal engine mechanics.

### 1. Fundamental Anchors


| Anchor | Real-World UTC Date / Unix MS | In-Game IxTime Date / Unix MS | Multiplier | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Real-World Epoch** | October 4, 2020 00:00:00 UTC<br/>`1601769600000` | October 4, 2020 00:00:00 UTC<br/>`1601769600000` | `4.0x` | Inception of the IxTime simulation |
| **In-Game Epoch** | — | January 1, 2028 00:00:00 UTC<br/>`1830297600000` | — | Nation roster baseline anchor (`getYearsSinceGameEpoch`) |
| **Speed Change Pivot** | July 27, 2025 00:00:00 UTC<br/>`1753574400000` | January 1, 2040 00:00:00 UTC<br/>`2208988800000` | `2.0x` | Community transition from 4x speed to 2x speed |

### 2. Time Dilation Eras

1. **Era 1 (Historical / Pre-Pivot)**:
   - Active from `October 4, 2020` to `July 27, 2025` real-world time.
   - Dilation Multiplier: **4.0x** (1 real day = 4 IxTime days; 1 real year = 4 IxTime years).
   - In 4.81 real years, the simulation traversed ~19.24 game years (reaching Jan 1, 2040).
2. **Era 2 (Current / Post-Pivot)**:
   - Active from `July 27, 2025` onwards.
   - Dilation Multiplier: **2.0x** (1 real day = 2 IxTime days; 6 real months = 1 IxTime year).
   - Designed to balance dynamic international statecraft with sustainable narrative pacing.

### 3. Conversion Formulas

#### Real-to-IxTime Forward Conversion (`convertToIxTime`)

$$\text{IxTime}(t_{\text{real}}) = \begin{cases} 
T_{\text{pivot, ix}} + (t_{\text{real}} - T_{\text{pivot, real}}) \times M_{\text{post}} & \text{if } t_{\text{real}} \ge T_{\text{pivot, real}} \\
T_{\text{epoch, real}} + (t_{\text{real}} - T_{\text{epoch, real}}) \times M_{\text{base}} & \text{if } t_{\text{real}} < T_{\text{pivot, real}} 
\end{cases}$$

Where:
- $T_{\text{pivot, real}} = 1753574400000\text{ ms}$ (2025-07-27T00:00:00Z)
- $T_{\text{pivot, ix}} = 2208988800000\text{ ms}$ (2040-01-01T00:00:00Z)
- $T_{\text{epoch, real}} = 1601769600000\text{ ms}$ (2020-10-04T00:00:00Z)
- $M_{\text{base}} = 4.0$, $M_{\text{post}} = 2.0$

#### IxTime-to-Real Inverse Conversion (`convertFromIxTime`)

$$t_{\text{real}}(t_{\text{ix}}) = \begin{cases} 
T_{\text{pivot, real}} + \frac{t_{\text{ix}} - T_{\text{pivot, ix}}}{M_{\text{post}}} & \text{if } t_{\text{ix}} \ge T_{\text{pivot, ix}} \\
T_{\text{epoch, real}} + \frac{t_{\text{ix}} - T_{\text{epoch, real}}}{M_{\text{base}}} & \text{if } t_{\text{ix}} < T_{\text{pivot, ix}} 
\end{cases}$$

#### Game Year Progression Calculation

$$\text{ElapsedYears}(t_{\text{ix}}) = \frac{t_{\text{ix}} - T_{\text{game-epoch}}}{365.25 \times 86,400,000\text{ ms}}$$
$$\text{CurrentGameYear}(t_{\text{ix}}) = 2028 + \lfloor \text{ElapsedYears}(t_{\text{ix}}) \rfloor$$

*Note: IxTime uses a Julian astronomical average year ($365.25\text{ days} = 31,557,600,000\text{ ms}$) for continuous year-fraction offsets while relying on standard UTC Gregorian calendar dates for month and day rendering.*

---

## Core Backend Library (`src/lib/ixtime/`)

The backend temporal engine architecture is split into three decoupled modules:

### 1. `core.ts` — The Master Time Core
The `IxTime` class provides synchronous static methods for fast in-process time calculations:
- `IxTime.getCurrentIxTime()`: Returns current in-game timestamp (ms). Honors memory overrides or computes natural progression from the speed pivot.
- `IxTime.getCurrentGameYear(ixTime?)`: Returns current 4-digit game year (e.g. `2042`).
- `IxTime.getYearsSinceGameEpoch(ixTime?)`: Computes floating-point years elapsed since Jan 1, 2028.
- `IxTime.formatIxTime(ixTime, includeTime?)`: Returns formatted string: `"Wednesday, March 14, 2042 16:30:00 (ILT)"` (Ixnay Local Time).
- `IxTime.addYears(ixTime, years)` / `IxTime.addMonths(ixTime, months)`: Exact forward calendar projection.
- `IxTime.convertFromIxTime(ixTime)`: Calculates the real-world physical timestamp when an in-game IxTime event will arrive.
- `IxTime.predictIxTimeAfterRealHours(realHours, multiplier?)`: Forward-predicts in-game timestamp given real hours elapsed.
- `IxTime.setNaturalMultiplier(multiplier)`: Restores speed to the canonical era multiplier or flags custom manual override.

### 2. `sync.ts` — Synchronization Manager (`IxTimeSyncManager`)
A server-side singleton managing cross-service consistency:
- **Sync Targets**: Registers the Discord bot (`http://localhost:3001` or `IXTIME_BOT_URL`).
- **Drift Thresholds**:
  - `DRIFT_WARNING_THRESHOLD`: $1,000\text{ ms}$ ($1\text{ second}$). Emits warning log.
  - `DRIFT_CRITICAL_THRESHOLD`: $5,000\text{ ms}$ ($5\text{ seconds}$). Triggers automated drift correction by posting override sync packets to the target endpoint.
  - `ACCURACY_THRESHOLD`: $99.99\%$.
- **Polling Loop**: Runs every 15 seconds (using `.unref()` so background timers do not block process teardown). Disabled automatically in test suites (`NODE_ENV === "test"`).

### 3. `accuracy.ts` — Automated Accuracy Verifier (`IxTimeAccuracyVerifier`)
Maintains 11 rigorous mathematical validation suites ensuring $>99.9998\%$ calculation integrity:
1. `epoch_real_world`: Validates Oct 4, 2020 exact millisecond match.
2. `epoch_in_game`: Validates Jan 1, 2028 baseline match.
3. `transition_4x_to_2x`: Validates exact intersection at July 27, 2025 $\equiv$ Jan 1, 2040.
4. `transition_continuity`: Asserts zero time gap/jump ($\Delta t \le 1\text{ ms}$) across transition boundary.
5. `calc_4x_period` & `calc_2x_period`: Validates linear speed slope precision in both eras.
6. `calc_year_progression`: Validates year rollover arithmetic.
7. `edge_leap_years`: Ensures quadrennial leap day ($365.25\text{ d}$) stability.
8. `edge_dst_transitions`: Proves immunity to local daylight saving shifts via UTC-only arithmetic.
9. `edge_large_numbers`: Asserts IEEE-754 64-bit float precision for timestamps beyond year 2100.
10. `sync_real_to_ix`: Proves bijective round-trip equivalence ($\text{convertFromIxTime}(\text{convertToIxTime}(t)) \equiv t$).
11. `sync_consistency`: Verifies monotonically increasing clock output under sequential sampling.

---

## API & Gateway Specifications

### 1. Public tRPC Router (`src/server/api/routers/system.ts`)

```typescript
// Query: api.system.getCurrentIxTime
// Access: Public (no auth required)
{
  currentRealTime: string;      // ISO string
  currentIxTime: string;        // ISO string
  currentIxTimeNumber: number;  // Timestamp in ms (e.g. 2275938291000)
  formattedIxTime: string;      // "Tuesday, June 18, 2042 14:22:01 (ILT)"
  multiplier: number;           // 2.0
  isPaused: boolean;            // false
  gameYear: number;             // 2042
  hasTimeOverride: boolean;     // false
}
```

### 2. Admin tRPC Router (`src/server/api/routers/admin/bot.ts`)

Restricted to `admin`, `owner`, or `staff` roles:
- `api.admin.bot.getBotStatus`: Returns aggregated bot health, latency, time state, guild count, and uptime.
- `api.admin.bot.syncBot`: Triggers immediate master clock synchronization.
- `api.admin.bot.pauseBot` / `resumeBot`: Pauses or unpauses time progression on the Discord bot daemon.
- `api.admin.bot.clearBotOverrides`: Clears temporary manual overrides on the bot.
- `api.admin.bot.getBotProcesses`: Inspects PM2 process state for `ixwiki-discord-bot` and `ixstats-ixtwitter`.
- `api.admin.bot.controlBotProcess`: Dispatches PM2 `start`, `stop`, or `restart`.
- `api.admin.bot.getBotProcessLogs`: Reads trailing 50 lines of stdout/stderr from PM2 logs.

### 3. REST API Route Handlers

| Route | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/api/ixtime/current` | `GET` | Public | Returns current timestamp, multiplier, game year, and status. |
| `/api/ixtime-status` | `GET` | Public | Full diagnostic dump of local time, bot health, and epoch parameters. |
| `/api/ixtime/health` | `GET` | Public | Health probe returning bot connection status. |
| `/api/ixtime/set-override` | `POST` | Admin | Sets custom `ixTimeMs` and optional speed multiplier. |
| `/api/ixtime/set-natural` | `POST` | Admin | Resets multiplier to the canonical era default (`2.0x`). |
| `/api/ixtime/sync-bot` | `POST` | Admin | Forces bi-directional sync with the Discord bot. |

---

## Frontend Temporal Architecture

To prevent CPU degradation and avoid re-rendering entire React component subtrees every second, frontend time telemetry is engineered with a **local client interpolation model** and **granular selector hooks**.

```
┌────────────────────────────────────────────────────────┐
│             SERVER (GET /api/ixtime/current)           │
└──────────────────────────┬─────────────────────────────┘
                           │ (Periodic sync every 30s)
                           ▼
┌────────────────────────────────────────────────────────┐
│     ZUSTAND STORE (src/stores/ixtime-store.ts)         │
│  - referenceTimestamp: Server IxTime at sync (ms)      │
│  - referenceRealTime: Client Date.now() at sync (ms)   │
│  - multiplier: 2.0                                     │
│  - tick(): local interpolation                         │
└──────────────────────────┬─────────────────────────────┘
                           │ (Interval tick every 1000ms)
                           ▼
┌────────────────────────────────────────────────────────┐
│    CALCULATE PROGRESSING TIME (Local Interpolation)    │
│    elapsed = (Date.now() - referenceRealTime)          │
│    currentIxTime = referenceTimestamp + (elapsed * M)  │
└──────────────────────────┬─────────────────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      ▼                    ▼                    ▼
useIxTimeTimestamp()   useIxTimeFormatted()  useIxTimeGameYear()
(Subscribers only re-render when their specific slice changes)
```

### 1. Zustand Store (`src/stores/ixtime-store.ts`)

The store records a server snapshot (`referenceTimestamp` and `referenceRealTime`). On every `tick()`, client-side IxTime is derived mathematically without firing network requests:

$$\text{CurrentIxTime} = \text{referenceTimestamp} + \Big((\text{Date.now}() - \text{referenceRealTime}) \times \text{multiplier}\Big)$$

### 2. Context Provider (`src/context/IxTimeContext.tsx`)

`IxTimeProvider` wraps the application root in `layout.tsx`. It manages two intervals:
- **1,000ms Tick**: Drives local time interpolation in the Zustand store.
- **30,000ms Sync**: Fetches authoritative time from `/api/ixtime/current` to eliminate any client clock skew.

### 3. Granular Selector Hooks

Components subscribe only to the exact temporal slice they require:

```typescript
import { 
  useIxTimeTimestamp, 
  useIxTimeFormatted, 
  useIxTimeGameYear, 
  useIxTimeMultiplier,
  useCurrentIxTime 
} from "~/context/IxTimeContext";

// Component that needs timestamp (re-renders every tick):
const timestamp = useIxTimeTimestamp();

// Component that only cares about the current game year (re-renders once every 6 real months):
const gameYear = useIxTimeGameYear();
```

---

## Statecraft & Domain Integrations

### 1. Statecraft Agenda & Horizon Feed (`src/lib/statecraft/calendar.ts`)
The `getUpcomingEvents()` pure function accepts `nowIxTime` and a collection of nation deadlines to generate a unified, chronological agenda:
- **Elections**: Filters uncompleted elections where `scheduledIxTime > nowIxTime`.
- **National Issues**: Filters active crises where `deadlineIxTime > nowIxTime`.
- **Legislative Terms**: Tracks end of parliamentary sessions (`termEndIxTime`).
- **Relative Formatters**: Provides humanized strings like `"in 3 days"`, `"tomorrow"`, or countdown badges like `"2d 4h"`.

### 2. Database Schema Timestamp Conventions (`prisma/schema/`)

IxTime fields in PostgreSQL models use two conventions:
1. **`Float` Unix Millisecond Epochs** (Recommended for Statecraft simulation):
   - `Issue.deadlineIxTime`: Timestamp when unaddressed issues auto-resolve.
   - `Issue.reconReadyIxTime`: Timestamp when intelligence recon findings unlock.
   - `ActivitySchedule.scheduledIxTime`: Scheduled cabinet meetings or executive events.
   - `CabinetPolicy.effectiveIxTime`: Statutory implementation date.
   - `SportsFixture.scheduledIxTime`: Sports match kickoff timestamp.
2. **`DateTime` Timestamps** (Standard PostgreSQL `timestamptz`):
   - `CalculationLog.ixTimeTimestamp`: Snapshot date recorded during economic batch runs.
   - `VitalitySnapshot.ixTimeTimestamp`: Longitudinal telemetry index.

---

## Operational Guide & Configuration

### 1. Environment Variables

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `IXTIME_BOT_URL` | Server | `http://localhost:3001` | Internal URL for the Discord bot IxTime microservice. |
| `NEXT_PUBLIC_IXTIME_BOT_URL` | Client/Browser | `http://localhost:3001` | Public fallback URL for bot health checks. |
| `IXTIME_BOT_SECRET` | Server | Optional | Shared secret token for authenticating administrative bot time overrides. |

### 2. Port Allocations

- **Port 3000**: Next.js local development server (`bun run dev`).
- **Port 3001**: `ixwiki-discord-bot` Discord time bot & API daemon.
- **Port 3550**: Production standalone application server (`bun run start:prod`).

### 3. Production Daemon Management (PM2)

In production, PM2 supervises the bot process alongside the web platform:
```bash
# Check status of time daemon
pm2 status ixwiki-discord-bot

# View live time logs
pm2 logs ixwiki-discord-bot --lines 50

# Restart bot if clock drift is reported
pm2 restart ixwiki-discord-bot
```

### 4. Operational Troubleshooting

| Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **"Bot connection failed" warning in Admin** | `ixwiki-discord-bot` is not running on port 3001. | The app automatically falls back to local server-side calculation. Start the bot via PM2 or ignore if running in isolated local dev. |
| **Client clock jumps or stutters** | Client machine system clock adjusted or tab was throttled. | The next 30s background sync from `/api/ixtime/current` automatically recalibrates `referenceRealTime`. |
| **Drift warnings in server logs (`>1000ms`)** | Network latency or clock skew on external bot service. | `IxTimeSyncManager` will auto-correct if drift exceeds 5,000ms. If persistent, check NTP sync on the host server (`timedatectl status`). |

---


*Over-engineering, duplication, and unnecessary abstractions eliminated:*

- `delete` **`src/app/api/ixtime/set-override-direct/`**: ✅ Deleted unreferenced legacy duplicate route handler. All overrides cleanly route to authenticated `POST /api/ixtime/set-override`.
- `shrink` **`src/app/api/ixtime-status/route.ts`**: ✅ Cleaned up into a concise, lightweight status proxy.
- `shrink` **`src/context/IxTimeContext.tsx`**: ✅ Purged redundant wrapper functions; directly re-exports granular Zustand selectors (`useIxTimeTimestamp`, `useIxTimeFormatted`, `useIxTimeGameYear`, `useIxTimeMultiplier`, `useIxTimeIsPaused`, `useIxTimeAll`, `useIxTimeActions`) for $O(1)$ selective component re-rendering.
- `yagni` **`src/lib/ixtime/accuracy.ts` runtime invocation in `updateMasterState()`**: ✅ Eliminated recurring execution of 11 dynamic test suites from the 15s server sync loop. Verification tests now execute exclusively in dedicated Jest suites.
- `shrink` **`src/lib/ixtime/core.ts` legacy fallbacks**: ✅ Removed uncalled `getCurrentIxTimeInternal()` duplicate and simplified override logic.

**Net Reduction Summary:**  
~380 lines of boilerplate removed, 1 dead HTTP route deleted, recurring test overhead eliminated from the background server loop, and 2 dedicated Jest test suites added in [`src/tests/lib/ixtime/`](file:///home/jxsig/projects/ixstats/src/tests/lib/ixtime/).

---

## Related Documentation

- [Statecraft Game Loops & Decision Simulator](./statecraft/statecraft-game-loops.md)
- [MyCountry Command Suite Specification](./mycountry.md)
- [Halo Dynamic Island & Wayfinding](./halo.md)
- [MyLeague Sports Simulation Engine](./myleague.md)
- [Versioning & Release Architecture](../reference/revision.md)
- [Complete tRPC API Catalog](../reference/api-complete.md#system-router)
