/**
 * The live IIWiki test on the admin panel (/admin/iiwiki): one real request per kind of call the app makes, each
 * classified the way Cloudflare and MediaWiki answer: ok, blocked by a Cloudflare rule, held at a Cloudflare challenge,
 * rate limited, a MediaWiki API error, another HTTP error, a timeout, or a network failure.
 *
 * The test goes around `upstreamGuard` on purpose: it must answer while the breaker is open or the IIWiki switch is off
 * (that is when an administrator needs it), and its failures must not open the breaker for real readers. It is
 * throttled instead: one run per `PROBE_COOLDOWN_MS` per process (a second click gets the last run back), the requests
 * go one after another with a pause between them, and each reads at most `MAX_BODY_BYTES`.
 */
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import type { IiwikiFeature } from "~/lib/wiki-os/iiwiki-switch";
import { readCappedText } from "~/lib/wiki-os/upstream-guard";
import { SISTER_WIKI_HOSTS, sisterWikiApiUrl } from "~/lib/wiki-os/wiki-hosts";

export const PROBE_COOLDOWN_MS = 20_000;
const PROBE_TIMEOUT_MS = 10_000;
const PAUSE_MS = 300;
const MAX_BODY_BYTES = 64 * 1024;

export type ProbeVerdict =
  | "ok"
  | "cloudflare-block"
  | "cloudflare-challenge"
  | "rate-limited"
  | "api-error"
  | "http-error"
  | "timeout"
  | "network";

/** What an answer should be when it is the wiki's own. */
type Expect = "json" | "text" | "binary";

export interface ProbeAnswer {
  status: number;
  headers: Headers;
  body: string;
  expect: Expect;
}

export interface ProbeClassification {
  verdict: ProbeVerdict;
  detail: string;
}

const BLOCK_MARKERS = ["you have been blocked", "Attention Required! | Cloudflare"];
const CHALLENGE_MARKERS = ["challenge-platform", "Just a moment...", "cf-chl-"];

function cloudflareVerdict(answer: ProbeAnswer): ProbeClassification | null {
  if (answer.headers.get("cf-mitigated") === "challenge") {
    return { verdict: "cloudflare-challenge", detail: "Cloudflare challenge (cf-mitigated)" };
  }
  if (BLOCK_MARKERS.some((marker) => answer.body.includes(marker))) {
    return {
      verdict: "cloudflare-block",
      detail: "Cloudflare block page: a firewall rule refused this request",
    };
  }
  if (CHALLENGE_MARKERS.some((marker) => answer.body.includes(marker))) {
    return { verdict: "cloudflare-challenge", detail: "Cloudflare challenge page" };
  }
  return null;
}

function jsonVerdict(body: string): ProbeClassification {
  let parsed: { error?: { code?: string; info?: string } } | null;
  try {
    parsed = JSON.parse(body) as { error?: { code?: string; info?: string } } | null;
  } catch {
    return { verdict: "http-error", detail: "A 2xx answer that is not JSON" };
  }
  if (parsed?.error) {
    return {
      verdict: "api-error",
      detail: `${parsed.error.code ?? "error"}: ${parsed.error.info ?? ""}`.trim(),
    };
  }
  return { verdict: "ok", detail: "JSON answer" };
}

/** How an answer reads: Cloudflare first (its pages come with any status), then the status, then the body. */
export function classifyProbeAnswer(answer: ProbeAnswer): ProbeClassification {
  const cloudflare = cloudflareVerdict(answer);
  if (cloudflare) return cloudflare;
  if (answer.status === 429) return { verdict: "rate-limited", detail: "HTTP 429" };
  if (answer.status < 200 || answer.status >= 300) {
    return { verdict: "http-error", detail: `HTTP ${answer.status}` };
  }
  if (answer.expect === "json") return jsonVerdict(answer.body);
  return { verdict: "ok", detail: answer.headers.get("content-type") ?? "answer" };
}

export interface ProbeCheck {
  id: string;
  label: string;
  /** The IIWiki switch features whose calls this check stands for. */
  features: IiwikiFeature[];
  expect: Expect;
  /** The URL to request, given the api.php URL and what earlier checks found. */
  url: (api: string, found: ProbeFindings) => string | null;
}

/** What earlier checks found that later ones use. */
interface ProbeFindings {
  fileUrl?: string;
}

const query = (api: string, params: Record<string, string>) =>
  `${api}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;

const indexPhp = (api: string) => api.replace(/api\.php$/, "index.php");

export const PROBE_CHECKS: ProbeCheck[] = [
  {
    id: "siteinfo",
    label: "Site info",
    features: ["proxy", "identity"],
    expect: "json",
    url: (api) => query(api, { action: "query", meta: "siteinfo" }),
  },
  {
    id: "parse",
    label: "Render a page (parse)",
    features: ["reader", "embeds"],
    expect: "json",
    url: (api) => query(api, { action: "parse", page: "Main_Page", prop: "text|displaytitle" }),
  },
  {
    id: "raw",
    label: "Page wikitext (action=raw)",
    features: ["reader"],
    expect: "text",
    url: (api) => `${indexPhp(api)}?${new URLSearchParams({ title: "Main_Page", action: "raw" })}`,
  },
  {
    id: "extracts",
    label: "Intro and lead image",
    features: ["country"],
    expect: "json",
    url: (api) =>
      query(api, {
        action: "query",
        prop: "extracts|pageimages",
        exintro: "1",
        titles: "Main_Page",
      }),
  },
  {
    id: "search",
    label: "Search",
    features: ["search"],
    expect: "json",
    url: (api) => query(api, { action: "query", list: "search", srsearch: "nation", srlimit: "1" }),
  },
  {
    id: "allpages",
    label: "Page listing",
    features: ["cards", "realms"],
    expect: "json",
    url: (api) => query(api, { action: "query", list: "allpages", aplimit: "1" }),
  },
  {
    id: "fileinfo",
    label: "File info",
    features: ["media"],
    expect: "json",
    url: (api) => query(api, { action: "query", list: "allimages", ailimit: "1", aiprop: "url" }),
  },
  {
    id: "filebytes",
    label: "File bytes",
    features: ["media"],
    expect: "binary",
    url: (_api, found) => found.fileUrl ?? null,
  },
];

export interface ProbeResult {
  id: string;
  label: string;
  features: IiwikiFeature[];
  /** The URL requested; null when the check was skipped. */
  url: string | null;
  verdict: ProbeVerdict | "skipped";
  detail: string;
  status: number | null;
  ms: number | null;
  cfRay: string | null;
}

export interface ProbeRun {
  /** The api.php the app's own calls use (the development relay in development). */
  appApiUrl: string;
  /** IIWiki's own api.php, which the test calls. */
  directApiUrl: string;
  userAgent: string;
  ranAt: string;
  /** True when this is the last run handed back inside the cooldown. */
  cached: boolean;
  results: ProbeResult[];
}

function fileUrlFrom(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { query?: { allimages?: { url?: string }[] } };
    return parsed.query?.allimages?.[0]?.url;
  } catch {
    return undefined;
  }
}

async function runCheck(
  check: ProbeCheck,
  url: string
): Promise<{ result: ProbeResult; body: string }> {
  const started = Date.now();
  const base = { id: check.id, label: check.label, features: check.features, url };
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
        ...(check.expect === "binary" ? { Range: "bytes=0-1023" } : {}),
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await readCappedText(response, MAX_BODY_BYTES)) ?? "";
    const { verdict, detail } = classifyProbeAnswer({
      status: response.status,
      headers: response.headers,
      body: check.expect === "binary" ? body.slice(0, 2048) : body,
      expect: check.expect,
    });
    const result: ProbeResult = {
      ...base,
      verdict,
      detail,
      status: response.status,
      ms: Date.now() - started,
      cfRay: response.headers.get("cf-ray"),
    };
    return { result, body };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    const detail = error instanceof Error ? error.message : String(error);
    const result: ProbeResult = {
      ...base,
      verdict: timedOut ? "timeout" : "network",
      detail,
      status: null,
      ms: Date.now() - started,
      cfRay: null,
    };
    return { result, body: "" };
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRun: ProbeRun | null = null;
let lastRunAt = 0;
let running: Promise<ProbeRun> | null = null;

async function probe(): Promise<ProbeRun> {
  const directApiUrl = sisterWikiApiUrl(SISTER_WIKI_HOSTS.iiwiki);
  const found: ProbeFindings = {};
  const results: ProbeResult[] = [];
  for (const check of PROBE_CHECKS) {
    const url = check.url(directApiUrl, found);
    if (url === null) {
      results.push({
        id: check.id,
        label: check.label,
        features: check.features,
        url: null,
        verdict: "skipped",
        detail: "Needs a file URL from the file info check",
        status: null,
        ms: null,
        cfRay: null,
      });
      continue;
    }
    if (results.length > 0) await pause(PAUSE_MS);
    const { result, body } = await runCheck(check, url);
    if (check.id === "fileinfo" && result.verdict === "ok") found.fileUrl = fileUrlFrom(body);
    results.push(result);
  }
  return {
    appApiUrl: getMediaWikiApiUrl("iiwiki"),
    directApiUrl,
    userAgent: DEFAULT_USER_AGENT,
    ranAt: new Date().toISOString(),
    cached: false,
    results,
  };
}

/** Run the live test, or hand back the last run when it is younger than `PROBE_COOLDOWN_MS`. */
export async function runIiwikiProbe(): Promise<ProbeRun> {
  if (lastRun && Date.now() - lastRunAt < PROBE_COOLDOWN_MS) return { ...lastRun, cached: true };
  running ??= probe()
    .then((run) => {
      lastRun = run;
      lastRunAt = Date.now();
      return run;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** The last run in this process, if any. */
export function lastIiwikiProbe(): ProbeRun | null {
  return lastRun;
}
