/**
 * A fake XenForo REST API for the phase 4 export tests: no network. Routes map "path?query" (relative to the
 * client's apiUrl) to fixture files or to scripted responses, and a fake clock stands in for time and sleep.
 */
import fs from "node:fs";
import path from "node:path";

export const FAKE_API_URL = "https://forum.example.test/api";
export const FAKE_API_KEY = "test-key-SECRET-0123456789";

const FIXTURES = path.join(process.cwd(), "src/tests/fixtures/xenforo/api");

export function fixtureText(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8");
}

export type FakeAnswer = () => Response | Promise<Response>;

export function json(text: string, code = 200): Response {
  return new Response(text, { status: code, headers: { "content-type": "application/json" } });
}

export function fixture(name: string): FakeAnswer {
  return () => json(fixtureText(name));
}

export function status(code: number): FakeAnswer {
  return () => json(JSON.stringify({ errors: [{ code: "x", message: `status ${code}` }] }), code);
}

export interface RecordedCall {
  route: string;
  headers: Headers;
}

export interface FakeApi {
  fetch: typeof fetch;
  calls: RecordedCall[];
  /** Queue answers for a route: each request takes the next one; the last one repeats. */
  on: (route: string, ...answers: FakeAnswer[]) => void;
}

export function createFakeApi(): FakeApi {
  const routes = new Map<string, FakeAnswer[]>();
  const calls: RecordedCall[] = [];
  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(FAKE_API_URL)) throw new Error(`unexpected request to ${url}`);
    const route = url.slice(FAKE_API_URL.length);
    calls.push({ route, headers: new Headers(init?.headers) });
    const queue = routes.get(route);
    if (!queue?.length) return json(JSON.stringify({ errors: [] }), 404);
    const answer = queue.length > 1 ? queue.shift() : queue[0];
    if (!answer) throw new Error(`no answer for ${route}`);
    return answer();
  }) as typeof fetch;
  return {
    fetch: fakeFetch,
    calls,
    on: (route, ...answers) => routes.set(route, answers),
  };
}

export interface FakeClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  sleeps: number[];
}

export function createFakeClock(): FakeClock {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}
