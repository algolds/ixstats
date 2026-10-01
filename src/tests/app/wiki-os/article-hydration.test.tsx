/**
 * Plan 412 STOP condition: the route primes the article query on the server and the client reader
 * must find it in the hydrated cache, never fetch it a second time. This runs the real tRPC
 * hydration helper (`createHydrationHelpers`, which `~/trpc/server` uses) against the real query
 * keys of the React hooks (`createTRPCReact` + `getQueryKey`, which `api.wikios.getArticleHtml.useQuery`
 * uses), so a change to either side's key format fails here.
 */
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import {
  dehydrate,
  HydrationBoundary,
  hydrate,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { createTRPCReact, getQueryKey } from "@trpc/react-query";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { createQueryClient } from "~/trpc/query-client";
import { articleHtmlInput } from "~/lib/wiki-os/config";
import type { AppRouter } from "~/server/api/root";

const DATA = { title: "Aurelia", contentHtml: "<p>Aurelia</p>", stale: false };

type FakeCaller = Parameters<typeof createHydrationHelpers<AppRouter>>[0];
const caller = {
  wikios: {
    getArticleHtml: jest.fn(async (input: { title: string }) => ({ ...DATA, title: input.title })),
  },
} as unknown as FakeCaller;

/** What the route does: prime the query (`loadArticle`), then dehydrate (`HydrateClient`). */
async function serverSide(input: { title: string; redirect?: "no" }) {
  const serverClient = createQueryClient();
  const { trpc } = createHydrationHelpers<AppRouter>(caller, () => serverClient);
  await trpc.wikios.getArticleHtml.prefetch(input, { retry: false });
  return { serverClient, dehydrated: dehydrate(serverClient) };
}

/** The key `api.wikios.getArticleHtml.useQuery(input)` uses on the client. */
const reactKey = (input: { title: string; redirect?: "no" }) =>
  getQueryKey(createTRPCReact<AppRouter>().wikios.getArticleHtml, input, "query");

describe("the article query the route primes is the one the client reads (plan 412)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is primed under the key the client hook asks for", async () => {
    const input = articleHtmlInput("Aurelia", "ixwiki");
    const { serverClient } = await serverSide(input);

    expect(reactKey(input)).toEqual([["wikios", "getArticleHtml"], { input, type: "query" }]);
    expect(serverClient.getQueryData(reactKey(input))).toMatchObject({ title: "Aurelia" });
    // `prefetchedState` in ~/trpc/server reads this exact key.
    expect(
      serverClient.getQueryState([["wikios", "getArticleHtml"], { input, type: "query" }])?.status
    ).toBe("success");
  });

  it("is primed under its own key for ?redirect=no", async () => {
    const plain = articleHtmlInput("Old name", "ixwiki");
    const noRedirect = articleHtmlInput("Old name", "ixwiki", { followRedirect: false });
    const { serverClient } = await serverSide(noRedirect);

    expect(serverClient.getQueryData(reactKey(noRedirect))).toBeDefined();
    expect(serverClient.getQueryData(reactKey(plain))).toBeUndefined();
  });

  it("runs the server procedure once for the prefetch", async () => {
    await serverSide(articleHtmlInput("Aurelia", "ixwiki"));
    expect(caller.wikios.getArticleHtml).toHaveBeenCalledTimes(1);
  });

  it("the hydrated data is fresh for the reader's staleTime, so a mounted reader does not refetch", async () => {
    const input = articleHtmlInput("Aurelia", "ixwiki");
    const { dehydrated } = await serverSide(input);

    const browser = createQueryClient();
    hydrate(browser, dehydrated);
    const query = browser.getQueryCache().find({ queryKey: reactKey(input) });

    expect(query?.state.data).toMatchObject({ title: "Aurelia" });
    expect(query?.isStaleByTime(10 * 60 * 1000)).toBe(false);
  });

  it("a reader rendered inside HydrationBoundary has the article on its first render and never calls its fetcher", async () => {
    const input = articleHtmlInput("Aurelia", "ixwiki");
    const { dehydrated } = await serverSide(input);
    const fetcher = jest.fn(async () => DATA);

    function Reader() {
      // The options ArticlePageClient passes to api.wikios.getArticleHtml.useQuery.
      const { data } = useQuery({
        queryKey: reactKey(input),
        queryFn: fetcher,
        staleTime: (query) => (query.state.data?.stale ? 0 : 10 * 60 * 1000),
      });
      return createElement("article", null, data?.title ?? "spinner");
    }

    const fresh = createQueryClient(); // what TRPCReactProvider builds: the browser singleton, or one per server render
    render(
      createElement(
        QueryClientProvider,
        { client: fresh },
        createElement(HydrationBoundary, { state: dehydrated }, createElement(Reader))
      )
    );

    // Synchronously, before any effect or promise: server-rendered HTML holds the article.
    expect(screen.getByRole("article")).toHaveTextContent("Aurelia");
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("a stale article (its render pending) is fetched again at once, as the reader's staleTime asks", async () => {
    const input = articleHtmlInput("Aurelia", "ixwiki");
    (caller.wikios.getArticleHtml as jest.Mock).mockResolvedValueOnce({ ...DATA, stale: true });
    const { dehydrated } = await serverSide(input);
    const fetcher = jest.fn(async () => DATA);

    function Reader() {
      const { data } = useQuery({
        queryKey: reactKey(input),
        queryFn: fetcher,
        staleTime: (query) => (query.state.data?.stale ? 0 : 10 * 60 * 1000),
      });
      return createElement("article", null, data?.title ?? "spinner");
    }
    render(
      createElement(
        QueryClientProvider,
        { client: createQueryClient() },
        createElement(HydrationBoundary, { state: dehydrated }, createElement(Reader))
      )
    );

    expect(screen.getByRole("article")).toHaveTextContent("Aurelia"); // shown at once...
    await screen.findByRole("article");
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1); // ...and asked for again: the render was pending
  });

  it("a failed prefetch is not dehydrated: the client asks for itself", async () => {
    (caller.wikios.getArticleHtml as jest.Mock).mockRejectedValueOnce(new Error("NOT_FOUND"));
    const { dehydrated } = await serverSide(articleHtmlInput("Nowhere", "ixwiki"));

    expect(dehydrated.queries).toHaveLength(0);
  });
});
