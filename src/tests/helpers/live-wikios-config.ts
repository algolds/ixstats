/**
 * `wikiosConfig` for tests that change the MediaWiki environment variables while they run (plan 415).
 *
 * The real `wikiosConfig` is built once, when `config.ts` loads: a test that sets `process.env.WIKIOS_MEDIAWIKI_API`
 * or `WIKIOS_MEDIAWIKI_BOT_USER` in a `beforeEach` would never be seen by it. This returns the module's exports with
 * a `wikiosConfig` whose `mediawiki` block is rebuilt from the environment on every read, so such a test keeps
 * setting variables. Use it in the test file's own hoisted mock:
 *
 *   jest.mock("~/lib/wiki-os/config", () =>
 *     jest.requireActual("~/tests/helpers/live-wikios-config").withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
 *   );
 */
import type * as ConfigModule from "~/lib/wiki-os/config";

export function withLiveEnvironment(actual: typeof ConfigModule): typeof ConfigModule {
  const live = {
    ...actual.wikiosConfig,
    get mediawiki() {
      return actual.buildWikiosConfig({
        publicUrl: process.env.NEXT_PUBLIC_MEDIAWIKI_URL,
        internalApiUrl: process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL,
        writeApiUrl: process.env.WIKIOS_MEDIAWIKI_API,
        botUser: process.env.WIKIOS_MEDIAWIKI_BOT_USER,
      }).mediawiki;
    },
  };
  return { ...actual, wikiosConfig: live };
}
