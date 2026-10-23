/**
 * A nation of another wiki (an Eurth nation on IIWiki) reads its own wiki page everywhere the country is shown: the
 * dossier (`useDossier`), the map's info panel (`useCountryPanelData`) and the country profile's lore
 * (`useCountryProfileLayer`), whose article text and link are that wiki's too. An IxWiki country reads as before. The
 * profile names its sovereign by their passport handle, then their forum name, never an old wiki name.
 */
import { act, renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const calls: Array<{ path: string; input: object; options: { enabled?: boolean } | undefined }> =
    [];
  const refresh = { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false };
  const procedure = (path: string) => ({
    useQuery: (input: object, options?: { enabled?: boolean }) => {
      calls.push({ path, input, options });
      return { data: undefined, isLoading: false, error: null, refetch: jest.fn() };
    },
    useMutation: () => refresh,
  });
  const api = new Proxy(
    {},
    {
      get: (_r, router: string) =>
        new Proxy({}, { get: (_p, proc: string) => procedure(`${router}.${proc}`) }),
    }
  );
  return { api, calls, refresh };
});

import { useDossier } from "~/hooks/useDossier";
import { useCountryPanelData } from "~/hooks/useCountryPanelData";
import { useCountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import type { CountryWithEconomicData } from "~/types/ixstats";

const trpc = jest.requireMock<{
  calls: Array<{ path: string; input: object; options: { enabled?: boolean } | undefined }>;
  refresh: { mutateAsync: jest.Mock };
}>("~/trpc/react");
const inputsOf = (path: string) => trpc.calls.filter((c) => c.path === path).map((c) => c.input);

const COUNTRY_DATA = {
  currentPopulation: 1,
  currentGdpPerCapita: 1,
  currentTotalGdp: 1,
  economicTier: "Developing",
};

beforeEach(() => {
  trpc.calls.length = 0;
  trpc.refresh.mutateAsync.mockClear();
});

describe("useDossier", () => {
  it("reads an Eurth nation's profile from its own IIWiki page, and refreshes that one", async () => {
    const { result } = renderHook(() =>
      useDossier({
        countryName: "Afropa",
        wikiSource: "iiwiki",
        wikiPageTitle: "Afropan Republic",
        countryData: COUNTRY_DATA,
      })
    );

    expect(inputsOf("wikiCache.getCountryProfile")).toContainEqual({
      countryName: "Afropan Republic",
      wikiSource: "iiwiki",
    });
    await act(() => result.current.handleRefresh());
    expect(trpc.refresh.mutateAsync).toHaveBeenCalledWith({
      countryName: "Afropan Republic",
      wikiSource: "iiwiki",
    });
  });

  it("reads an IxWiki country by its name on IxWiki", () => {
    renderHook(() => useDossier({ countryName: "Urcea", countryData: COUNTRY_DATA }));

    expect(inputsOf("wikiCache.getCountryProfile")).toContainEqual({
      countryName: "Urcea",
      wikiSource: "ixwiki",
    });
  });
});

describe("useCountryPanelData", () => {
  it("asks for the section previews and images of the country itself, so its own wiki is read", () => {
    renderHook(() => useCountryPanelData("c-afr", "Afropa"));

    for (const path of ["countries.getWikiSectionPreviews", "countries.getWikiPageImages"]) {
      expect(inputsOf(path)).toContainEqual({ countryName: "Afropa", countryId: "c-afr" });
    }
  });
});

describe("useCountryProfileLayer", () => {
  it("reads an Eurth nation's article text from IIWiki and links its lore there", () => {
    const country = {
      id: "c-afr",
      name: "Afropa",
      wikiSource: "iiwiki",
      wikiPageTitle: "Afropa",
    } as CountryWithEconomicData;

    const { result } = renderHook(() =>
      useCountryProfileLayer({ country, flagUrl: null, isOwner: false, currentIxTime: 0 })
    );

    const article = trpc.calls.find(
      (c) => c.path === "wikios.getWikitext" && c.options?.enabled === true
    );
    expect(article?.input).toEqual({ title: "Afropa", wikiSource: "iiwiki" });
    expect(result.current?.lore.wikiHref).toBe("/wiki/Afropa?source=iiwiki");
  });

  it.each([
    [{ handle: "ruler", forumUsername: "ForumRuler", wikiUsername: "Wiki Ruler" }, "ruler"],
    [{ handle: null, forumUsername: "ForumRuler", wikiUsername: "Wiki Ruler" }, "ForumRuler"],
    [{ handle: null, forumUsername: null, wikiUsername: "Wiki Ruler" }, null],
  ])("names the sovereign %o as %s", (owner, username) => {
    const country = { id: "c-urc", name: "Urcea", owner } as CountryWithEconomicData & {
      owner: typeof owner;
    };

    const { result } = renderHook(() =>
      useCountryProfileLayer({ country, flagUrl: null, isOwner: false, currentIxTime: 0 })
    );

    expect(result.current?.identity.sovereign?.username).toBe(username);
  });
});
