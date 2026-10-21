/** @jest-environment node */
/**
 * A Commons crawl, read for real against a fake Commons: titles only (`cmtype=file`), paced, each answer checked. A
 * refusal or a failed later page is a BAD_GATEWAY, never a shorter list; a list cut short says it was truncated.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: jest.fn(async () => []) } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/server/modules/cards/cards.import-jobs", () => ({
  MAX_IMPORT_TITLES: 2000,
  createImportJob: jest.fn(),
  kickImportRunner: jest.fn(),
}));

import { TRPCError } from "@trpc/server";
import { CRAWL_BUDGET_MS, crawlImportTitles } from "~/server/modules/cards/cards.import-crawl";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  jest.restoreAllMocks();
});

/** Commons answering each request with the next answer; `onAnswer` runs as each is served. */
function commonsAnswers(
  answers: Array<{ status: number; body: string }>,
  onAnswer: (index: number) => void = () => undefined
) {
  const requests: URL[] = [];
  globalThis.fetch = (async (input: string) => {
    const url = new URL(input);
    if (url.hostname !== "commons.wikimedia.org") throw new Error(`unexpected request to ${url}`);
    requests.push(url);
    onAnswer(requests.length - 1);
    const answer = answers[Math.min(requests.length, answers.length) - 1]!;
    return new Response(answer.body, {
      status: answer.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return requests;
}

const page = (titles: string[], cont?: string) => ({
  status: 200,
  body: JSON.stringify({
    query: { categorymembers: titles.map((title) => ({ title })) },
    ...(cont ? { continue: { cmcontinue: cont } } : {}),
  }),
});

const crawl = () =>
  crawlImportTitles(createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) }) as never, {
    source: "commons",
    mode: "category",
    category: "Flags",
    limit: 2000,
  });

async function refusal(promise: Promise<object>): Promise<TRPCError> {
  const error = await promise.then(
    () => null,
    (reason: Error) => reason
  );
  if (!(error instanceof TRPCError)) throw new Error("the crawl did not refuse");
  return error;
}

describe("a Commons crawl", () => {
  it("lists the category's image files by title, and says when its time cut the list", async () => {
    let clock = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => clock);
    const requests = commonsAnswers(
      [page(["File:Flag of Elm.svg", "Category:Flags of Elm", "File:Anthem.ogg"], "file|NEXT")],
      () => {
        clock += CRAWL_BUDGET_MS;
      }
    );
    await expect(crawl()).resolves.toEqual({
      entries: [{ title: "File:Flag of Elm.svg", carded: false }],
      truncated: true,
    });
    expect(requests).toHaveLength(1);
    expect(Object.fromEntries(requests[0]!.searchParams)).toMatchObject({
      list: "categorymembers",
      cmtitle: "Category:Flags",
      cmtype: "file",
      cmlimit: "500",
    });
  });

  it("reads the whole list when it ends, and is not truncated", async () => {
    commonsAnswers([page(["File:A.svg"], "file|B"), page(["File:B.png"])]);
    await expect(crawl()).resolves.toEqual({
      entries: [
        { title: "File:A.svg", carded: false },
        { title: "File:B.png", carded: false },
      ],
      truncated: false,
    });
  });

  it("rejects with a BAD_GATEWAY when a later request fails, rather than answering part of the list", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    commonsAnswers([page(["File:A.svg"], "file|B"), { status: 502, body: "" }]);
    const error = await refusal(crawl());
    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toBe("Could not read Wikimedia Commons. Try again later.");
  });

  it("rejects with the stopped message when Commons refuses", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    commonsAnswers([{ status: 403, body: "" }]);
    const error = await refusal(crawl());
    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toBe("Wikimedia Commons stopped answering (HTTP 403).");
  });
});
