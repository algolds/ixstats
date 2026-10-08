/**
 * The realm passport (`/r/{realm}/@{handle}`, served from `/r/[realm]/(region)/u/[username]`): one
 * holder's nations in one realm, titled with the realm's name from the region overview, showing the
 * payload's passport handle (never the URL segment). The old `/r/{realm}/{username}` path 308s to
 * it, and its layout carries the passport's noindex rule.
 */
import React, { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import type { PassportPayload, RealmItem } from "~/components/passport/types";

const permanentRedirect = jest.fn();
class NotFound extends Error {}
jest.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => permanentRedirect(url),
  notFound: () => {
    throw new NotFound("not found");
  },
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
import LegacyRealmPassportPage from "~/app/r/[realm]/[username]/page";

function membership(name: string): RealmItem {
  return {
    id: "eurth",
    name: "Eurth Concord",
    slug: "eurth",
    role: "member",
    isPrimary: false,
    country: {
      id: `c-${name}`,
      name,
      slug: name.toLowerCase(),
      flagUrl: null,
      coatOfArmsUrl: null,
      currentPopulation: 1_000_000,
      currentTotalGdp: 1_000_000_000,
      currentGdpPerCapita: 1000,
      continent: null,
      region: null,
      governmentType: null,
      currentPublicApproval: 50,
    },
  };
}

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
  it("asks for the holder's memberships in this realm only and renders those nations", async () => {
    queries.set("ixnayid.getRealms", [membership("Aurelia"), membership("Borovia")]);
    await renderPage();
    expect(queryInputs.get("ixnayid.getRealms")).toEqual({ handle: "alex", realm: "eurth" });
    expect(screen.getByRole("link", { name: "Aurelia" }).getAttribute("href")).toBe(
      "/countries/aurelia"
    );
    expect(screen.getByRole("link", { name: "Borovia" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Alex Pav" })).toBeTruthy();
    expect(screen.getByText("@alex · Realm passport in Eurth Concord")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Full passport/ }).getAttribute("href")).toBe("/@alex");
  });

  it("names the realm from the region overview when the holder has nothing here", async () => {
    queries.set("ixnayid.getRealms", []);
    await renderPage("%40alex");
    expect(queryInputs.get("ixnayid.getRealms")).toEqual({ handle: "alex", realm: "eurth" });
    expect(
      screen.getByText("@alex holds no membership or claimed country in Eurth Concord.")
    ).toBeTruthy();
  });

  it("shows and links the payload's passport handle when the URL names a legacy name", async () => {
    queries.set("ixnayid.getPassport", { ...passport, handle: "alex_h" });
    queries.set("ixnayid.getRealms", []);
    await renderPage("Alex%20Forum");
    expect(queryInputs.get("ixnayid.getRealms")).toEqual({ handle: "Alex Forum", realm: "eurth" });
    expect(screen.getByText("@alex_h · Realm passport in Eurth Concord")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Full passport/ }).getAttribute("href")).toBe(
      "/@alex_h"
    );
    expect(pageTitle).toHaveBeenLastCalledWith("Alex Pav (@alex_h) · Eurth Concord");
  });

  it("leaves the realm separator out of the title until the realm's name has loaded", async () => {
    queries.set("realms.region.overview", null);
    queries.set("ixnayid.getRealms", []);
    await renderPage();
    expect(pageTitle).toHaveBeenLastCalledWith("Alex Pav (@alex)");
    expect(screen.getByText("@alex")).toBeTruthy();
  });

  it("does not crash on a malformed segment", async () => {
    queries.set("ixnayid.getPassport", null);
    queries.set("ixnayid.getRealms", []);
    await renderPage("%E0%A4%A");
    expect(screen.getByText("Identity not found")).toBeTruthy();
  });

  it("says so when the identity does not exist", async () => {
    queries.set("ixnayid.getPassport", null);
    queries.set("ixnayid.getRealms", []);
    await renderPage("nobody");
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

describe("legacy realm passport path", () => {
  const legacy = (username: string) =>
    LegacyRealmPassportPage({ params: Promise.resolve({ realm: "eurth", username }) });

  beforeEach(() => permanentRedirect.mockClear());

  it("308s /r/{realm}/{username} to /r/{realm}/@{username}", async () => {
    await legacy("alex");
    expect(permanentRedirect).toHaveBeenLastCalledWith("/r/eurth/@alex");
  });

  it("keeps names that need encoding encoded", async () => {
    await legacy("Some%20Nation");
    expect(permanentRedirect).toHaveBeenLastCalledWith("/r/eurth/@Some%20Nation");
  });

  it("404s, never redirecting to itself, when the segment already starts with @", async () => {
    await expect(legacy("%40alex")).rejects.toThrow("not found");
    await expect(legacy("@alex")).rejects.toThrow("not found");
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it("404s on a malformed segment", async () => {
    await expect(legacy("%E0%A4%A")).rejects.toThrow("not found");
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});
