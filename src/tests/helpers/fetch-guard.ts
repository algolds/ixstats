/**
 * A `fetch` stand-in for the "no MediaWiki on a read path" tests (plan 418).
 *
 * A request to IxWiki's MediaWiki (ixwiki.com, the internal URL, localhost) is recorded and throws; code
 * that swallows the error still leaves the request in `ixwikiCalls()`, so a test asserts there is none.
 * A request to any other host is a sister wiki's: `sister` answers it (default: it fails the test's
 * expectation by throwing too, since a test that does not expect a sister call must not make one).
 */

export type SisterAnswer = (url: URL, init?: RequestInit) => unknown;

export interface FetchGuard {
  /** Every URL requested, whatever the host. */
  calls: () => string[];
  /** The requests that went to IxWiki's MediaWiki: must be empty on a read path. */
  ixwikiCalls: () => string[];
  restore: () => void;
}

const IXWIKI_HOSTS = ["ixwiki.com", "localhost", "127.0.0.1"];

function isIxwikiHost(url: URL): boolean {
  const internal = process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
  if (internal && url.hostname === new URL(internal).hostname) return true;
  return IXWIKI_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

function toUrl(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === "string") return new URL(input);
  return input instanceof URL ? input : new URL(input.url);
}

export function installFetchGuard(sister?: SisterAnswer): FetchGuard {
  const realFetch = globalThis.fetch;
  const requested: string[] = [];
  const toIxwiki: string[] = [];

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = toUrl(input);
    requested.push(url.toString());
    if (isIxwikiHost(url)) {
      toIxwiki.push(url.toString());
      throw new Error(`ixwiki MediaWiki must not be called on a read path: ${url.toString()}`);
    }
    if (!sister) throw new Error(`unexpected request to ${url.toString()}`);
    const body = await sister(url, init);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as typeof fetch;

  return {
    calls: () => [...requested],
    ixwikiCalls: () => [...toIxwiki],
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}
