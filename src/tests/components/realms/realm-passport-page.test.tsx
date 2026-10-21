/**
 * The realm passport (`/r/{realm}/@{handle}`, served from `/r/[realm]/(region)/u/[username]`): one
 * holder's nations in one realm, titled with the realm's name from the region overview, showing the
 * payload's passport handle (never the URL segment). Its layout carries the passport's noindex rule.
 */
import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
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
const passportIndexable = jest.fn<Promise<boolean>, [string]>();
jest.mock("~/server/modules/identity/identity.link-privacy", () => ({
  passportIndexable: (handle: string) => passportIndexable(handle),
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

import RealmPassportPage from "~/app/r/[realm]/(region)/u/[username]/page";
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

async function renderPage(username = "alex") {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <RealmPassportPage params={Promise.resolve({ realm: "eurth", username })} />
      </Suspense>
    );
  });
}

beforeEach(() => {
  pageTitle.mockClear();
  queries.clear();
  queryInputs.clear();
  queries.set("ixnayid.getPassport", passport);
  queries.set("realms.region.overview", { realm: { slug: "eurth", name: "Eurth Concord" } });
});

describe("realm passport page", () => {
  it("does not crash on a malformed segment", async () => {
    queries.set("ixnayid.getPassport", null);
    queries.set("ixnayid.getRealms", []);
    await renderPage("%E0%A4%A");
    expect(screen.getByText("Identity not found")).toBeTruthy();
  });
});

describe("realm passport metadata", () => {
  it("reads a malformed segment as it is instead of throwing", async () => {
    passportIndexable.mockResolvedValueOnce(true);
    await generateMetadata({ params: Promise.resolve({ realm: "eurth", username: "%E0%A4%A" }) });
    expect(passportIndexable).toHaveBeenLastCalledWith("%E0%A4%A");
  });

  it("is noindex when the holder turned search engine indexing off", async () => {
    passportIndexable.mockResolvedValueOnce(false);
    const metadata = await generateMetadata({
      params: Promise.resolve({ realm: "eurth", username: "%40alex" }),
    });
    expect(passportIndexable).toHaveBeenLastCalledWith("alex");
    expect(metadata).toEqual({ robots: { index: false, follow: false } });
  });

  it("adds nothing when the passport may be indexed", async () => {
    passportIndexable.mockResolvedValueOnce(true);
    const metadata = await generateMetadata({
      params: Promise.resolve({ realm: "eurth", username: "alex" }),
    });
    expect(metadata).toEqual({});
  });
});
