/**
 * The NationStates client used by the card import and sync: a refusal (429) or an outage (503) raises, so a run never
 * reads it as an empty deck; only a nation NationStates does not have (404) is no deck.
 */
import { nsApiClient } from "~/lib/nationstates/api-client";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

it.each([
  [429, "Too Many Requests", "raises RATE_LIMIT", "RATE_LIMIT"],
  [503, "Service Unavailable", "raises SERVER_ERROR", "SERVER_ERROR"],
  [404, "Not Found", "is no deck", null],
])("fetchDeck on HTTP %d (%s) %s", async (status, statusText, _outcome, error) => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status, statusText }) as never;
  if (error) await expect(nsApiClient.fetchDeck("testnation")).rejects.toThrow(error);
  else expect(await nsApiClient.fetchDeck("unknown_nation_xyz")).toBeNull();
});
