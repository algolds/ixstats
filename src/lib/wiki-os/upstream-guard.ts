// src/lib/wiki-os/upstream-guard.ts
// One guard in front of every outbound wiki API call (plan 2026-10-25 sister wikis, C3a). Server only: it calls
// other people's wikis, so client code never imports it (src/tests/architecture/client-server-entrypoints.test.ts).
//
// Per host (`new URL(url).host`), two things stand between a caller and the wiki:
//   - A breaker. Five failures in a row (a thrown fetch, a timeout, HTTP 403, 429 or 5xx, or a 2xx that is not JSON,
//     which is how a Cloudflare challenge looks) open it for 30 s; meanwhile every call fails fast with no request.
//     Then exactly one probe goes out while other calls keep failing fast. A successful probe closes the breaker and
//     resets it; a failed one reopens it for twice as long as last time, never more than 5 minutes. One `console.warn`
//     when a circuit opens and one when it closes.
//   - A limiter (`OutboundLimiter`): 8 calls in flight and 240 a minute. Past either the call is refused as busy with
//     no request, and that refusal is not a failure of the wiki.
// A failure throws `WikiUnavailableError`, which the tRPC formatter (`src/server/api/trpc/init.ts`) turns into
// SERVICE_UNAVAILABLE (503), or TOO_MANY_REQUESTS (429) when the reason is `busy`. The client sees the message ("IIWiki
// could not be reached just now.") and `{ wiki, reason }`, never the URL or the upstream answer.
//
// State is per process, in memory, and costs no timer: time is read from the clock when a call arrives, so nothing
// keeps the process alive and nothing leaks between tests. Production runs the Next server and server.mjs's cron jobs;
// where those are separate processes (or PM2 runs several instances), each has its own breakers and its own limiter,
// so a wiki can see up to 8 in flight and 240 a minute from each process, and each process learns of an outage on its
// own five failures. The numbers are a bound per process, not per deployment.
//
// Hosts are keyed as they are fetched: in development iiwiki is reached through the maps.ixwiki.com relay
// (`getMediaWikiApiUrl`), so the relay's host carries the breaker there. Only configured wiki URLs are passed in
// (`wiki-hosts.ts`, `config.ts`), so the map holds a handful of entries.

import { AppError } from "~/lib/app-error";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { OutboundLimiter, ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";
import { SISTER_WIKI_HOSTS, SISTER_WIKI_IDS, sisterWikiHost } from "~/lib/wiki-os/wiki-hosts";

/** Why a wiki gave no answer: it failed (`unreachable`), it is resting after failures (`circuit-open`), or it or we said busy. */
export type UnavailableReason = "unreachable" | "circuit-open" | "busy";

export class WikiUnavailableError extends AppError {
  constructor(
    readonly wiki: string,
    readonly reason: UnavailableReason
  ) {
    const busy = reason === "busy";
    super(
      busy ? "RATE_LIMITED" : "UNAVAILABLE",
      busy ? `${wiki} is busy; try again shortly.` : `${wiki} could not be reached just now.`,
      { wiki, reason }
    );
  }
}

export interface HostGuardOptions {
  /** Failures in a row that open the circuit. */
  failureThreshold: number;
  /** The first cooldown; each failed probe doubles it. */
  openMs: number;
  /** The longest cooldown. */
  maxOpenMs: number;
  maxConcurrent: number;
  perMinute: number;
  /** Clock, for tests. */
  now?: () => number;
}

export const SISTER_GUARD_OPTIONS: HostGuardOptions = {
  failureThreshold: 5,
  openMs: 30_000,
  maxOpenMs: 300_000,
  maxConcurrent: 8,
  perMinute: 240,
};

export interface GuardedRequest {
  timeoutMs: number;
  /** Defaults to `DEFAULT_USER_AGENT` (`IxStats-Builder`, which the sister wikis allow-list). */
  userAgent?: string;
}

/** How a call was let through: an ordinary call, or the one probe of a circuit past its cooldown. */
type Ticket = "call" | "probe";

/** A breaker's state; pure, the clock is passed in. */
class Circuit {
  /** Failures in a row, probes included. */
  private failures = 0;
  /** When the cooldown ends; null while closed. */
  private openUntil: number | null = null;
  /** Failed probes since the circuit last closed. */
  private reopenings = 0;
  private probing = false;

  constructor(private readonly options: HostGuardOptions) {}

  get failureCount(): number {
    return this.failures;
  }

  /** null refuses the call (open, or a probe already out). */
  admit(now: number): Ticket | null {
    if (this.openUntil === null) return "call";
    if (now < this.openUntil || this.probing) return null;
    this.probing = true;
    return "probe";
  }

  /** The admitted call never went out. */
  release(ticket: Ticket): void {
    if (ticket === "probe") this.probing = false;
  }

  /** True when this success closed the circuit; only the probe closes it (a call admitted before it opened does not). */
  succeed(ticket: Ticket): boolean {
    if (ticket === "probe") {
      this.failures = 0;
      this.reopenings = 0;
      this.openUntil = null;
      this.probing = false;
      return true;
    }
    this.failures = 0;
    return false;
  }

  /** The cooldown when this failure opened the circuit, else null. */
  fail(ticket: Ticket, now: number): number | null {
    if (ticket === "probe") {
      this.probing = false;
      this.failures += 1;
      this.reopenings += 1;
      return this.open(now);
    }
    if (this.openUntil !== null) return null;
    this.failures += 1;
    return this.failures >= this.options.failureThreshold ? this.open(now) : null;
  }

  private open(now: number): number {
    const cooldown = Math.min(this.options.openMs * 2 ** this.reopenings, this.options.maxOpenMs);
    this.openUntil = now + cooldown;
    return cooldown;
  }
}

/** Whether an answer is the wiki's (`ok`) or a failure, and of which kind. */
function verdictOf(response: Response): "ok" | "unreachable" | "busy" {
  if (response.status === 429) return "busy";
  if (response.ok) {
    return (response.headers.get("content-type") ?? "").includes("json") ? "ok" : "unreachable";
  }
  const wikiAnswered = response.status >= 400 && response.status < 500 && response.status !== 403;
  return wikiAnswered ? "ok" : "unreachable";
}

/** The wiki's answer, or why there is none. */
async function send(url: string, request: GuardedRequest): Promise<Response | UnavailableReason> {
  const userAgent = request.userAgent ?? DEFAULT_USER_AGENT;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": userAgent, "Api-User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch {
    return "unreachable";
  }
  const verdict = verdictOf(response);
  if (verdict === "ok") return response;
  // Nobody reads a failed answer: release its connection.
  await response.body?.cancel().catch(() => undefined);
  return verdict;
}

interface HostEntry {
  circuit: Circuit;
  limiter: OutboundLimiter;
}

export class HostGuard {
  private readonly hosts = new Map<string, HostEntry>();
  private readonly now: () => number;

  constructor(private readonly options: HostGuardOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  /** GET `url` (JSON expected). Returns the response for a 2xx JSON answer or a 4xx other than 403/429. */
  async fetch(url: string, request: GuardedRequest): Promise<Response> {
    const wiki = wikiNameForUrl(url);
    const entry = this.entryFor(new URL(url).host);
    const ticket = entry.circuit.admit(this.now());
    if (ticket === null) throw new WikiUnavailableError(wiki, "circuit-open");
    try {
      return await entry.limiter.run(() => this.attempt(url, request, wiki, entry.circuit, ticket));
    } catch (error) {
      if (!(error instanceof ThrottledError)) throw error;
      entry.circuit.release(ticket);
      throw new WikiUnavailableError(wiki, "busy");
    }
  }

  private async attempt(
    url: string,
    request: GuardedRequest,
    wiki: string,
    circuit: Circuit,
    ticket: Ticket
  ): Promise<Response> {
    const outcome = await send(url, request);
    if (outcome instanceof Response) {
      if (circuit.succeed(ticket))
        console.warn(`[upstream-guard] ${wiki}: circuit closed; requests resume.`);
      return outcome;
    }
    const cooldown = circuit.fail(ticket, this.now());
    if (cooldown !== null) {
      console.warn(
        `[upstream-guard] ${wiki}: circuit open after ${circuit.failureCount} failures in a row; ` +
          `next try in ${cooldown / 1000} s.`
      );
    }
    throw new WikiUnavailableError(wiki, outcome);
  }

  private entryFor(host: string): HostEntry {
    let entry = this.hosts.get(host);
    if (!entry) {
      entry = {
        circuit: new Circuit(this.options),
        limiter: new OutboundLimiter({
          name: host,
          maxConcurrent: this.options.maxConcurrent,
          perMinute: this.options.perMinute,
          now: this.now,
        }),
      };
      this.hosts.set(host, entry);
    }
    return entry;
  }
}

/** The process's guard for the sister wikis: one per process (see the header). */
export const upstreamGuard = new HostGuard(SISTER_GUARD_OPTIONS);

/** `/api/mediawiki/<id>/api.php`: the api.php proxy, which the development relay is. */
const RELAY_PATH = /^\/api\/mediawiki\/([^/]+)\/api\.php$/;

/** The name people know a wiki by, for the wiki `url` points at; its host when it is not a listed wiki. */
export function wikiNameForUrl(url: string): string {
  const parsed = new URL(url);
  const relayed = RELAY_PATH.exec(parsed.pathname)?.[1];
  const viaRelay = relayed === undefined ? null : sisterWikiHost(relayed);
  if (viaRelay) return viaRelay.name;
  const hostname = parsed.hostname.replace(/^www\./, "");
  const listed = SISTER_WIKI_IDS.map((id) => SISTER_WIKI_HOSTS[id]).find(
    (host) =>
      new URL(host.origin).hostname === hostname ||
      (host.mediaHosts as readonly string[]).includes(hostname)
  );
  return listed?.name ?? parsed.host;
}

/** `work`'s result, or null when its wiki was unavailable; any other error is rethrown. */
export async function unlessUnavailable<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof WikiUnavailableError) return null;
    throw error;
  }
}
