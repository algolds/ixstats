/**
 * The realm passport (`/r/{realm}/@{handle}`, served from `/r/[realm]/(region)/u/[username]`): one
 * holder's nations in one realm, titled with the realm's name from the region overview, showing the
 * payload's passport handle (never the URL segment). Its layout carries the passport's noindex rule.
 */
import type { PassportPayload } from "~/components/passport/types";

jest.mock("next/navigation", () => ({
  usePathname: () => "/r/eurth/u/alex",
}));
const pageTitle = jest.fn();
jest.mock("~/hooks/usePageTitle", () => ({
  usePageTitle: (options: { title: string }) => pageTitle(options.title),
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
/** The Clerk id a passport handle belongs to, and who turned search engine indexing off. */
const ownerOfHandle = jest.fn<Promise<string | null>, [string]>();
const switchedOff = jest.fn<Promise<Set<string>>, [unknown, string[], string]>();
jest.mock("~/server/modules/identity/identity.resolve", () => ({
  ...jest.requireActual("~/server/modules/identity/identity.resolve"),
  resolveHandleOwnerClerkId: (handle: string) => ownerOfHandle(handle),
}));
jest.mock("~/server/shared/privacy-permissions", () => ({
  ...jest.requireActual("~/server/shared/privacy-permissions"),
  usersWithSwitchOff: (db: unknown, ids: string[], key: string) => switchedOff(db, ids, key),
}));

/** `useQuery` answers from `queries` by procedure path and records its input in `queryInputs`. */
const queries = new Map<string, object | null>();
const queryInputs = new Map<string, object>();
jest.mock("~/trpc/react", () => {
  const procedure = (path: string) => ({
    useQuery: (input: object) => {
      queryInputs.set(path, input);
      return { data: queries.get(path), isLoading: false };
    },
  });
  return {
    api: {
      ixnayid: {
        getPassport: procedure("ixnayid.getPassport"),
        getRealms: procedure("ixnayid.getRealms"),
      },
      realms: { region: { overview: procedure("realms.region.overview") } },
    },
  };
});

import "~/app/r/[realm]/(region)/u/[username]/page";
import { generateMetadata } from "~/app/r/[realm]/(region)/u/[username]/layout";
const passport = {
  handle: "alex",
  account: {
    userId: "u1",
    clerkUsername: "alex",
    clerkDisplayName: "Alex Pav",
    clerkImageUrl: null,
  },
} as never as PassportPayload;
beforeEach(() => {
  pageTitle.mockClear();
  queries.clear();
  queryInputs.clear();
  queries.set("ixnayid.getPassport", passport);
  queries.set("realms.region.overview", { realm: { slug: "eurth", name: "Eurth Concord" } });
});
describe("realm passport metadata", () => {
  it("is noindex when the holder turned search engine indexing off", async () => {
    ownerOfHandle.mockResolvedValueOnce("clerk_alex");
    switchedOff.mockResolvedValueOnce(new Set(["clerk_alex"]));
    const metadata = await generateMetadata({
      params: Promise.resolve({ realm: "eurth", username: "%40alex" }),
    });
    expect(ownerOfHandle).toHaveBeenLastCalledWith("alex");
    expect(switchedOff).toHaveBeenLastCalledWith(
      expect.anything(),
      ["clerk_alex"],
      "searchEngineIndexing"
    );
    expect(metadata).toEqual({ robots: { index: false, follow: false } });
  });
});
