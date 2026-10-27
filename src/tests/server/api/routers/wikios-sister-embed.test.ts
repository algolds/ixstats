/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
//
// `wikios.sisterEmbed` (routers/wikios/sister.ts): the live embed behind a `Template:Sister` box, for anyone who can
// read the page. It takes only a wiki WikiOS reads (never IxWiki) and a title MediaWiki could hold, has a rate-limit
// bucket of its own per caller (`sisterembed`, spent only by reads from the wiki), and hands the request to `getSisterEmbed`. A wiki that cannot be reached reaches the
// client as SERVICE_UNAVAILABLE through the tRPC formatter.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: true }));
jest.mock("~/lib/wiki-os/services/sister-embed-service", () => ({
  __esModule: true,
  getSisterEmbed: jest.fn(),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { TRPCError } from "@trpc/server";
import { getSisterEmbed } from "~/lib/wiki-os/services/sister-embed-service";
import { WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosSisterRouter } from "~/server/api/routers/wikios/sister";
import { wikiosRouter } from "~/server/api/routers/wikios";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { clientErrorOf } from "~/tests/helpers/trpc-client-error";

const visitor = () => createMockRouterContext({ auth: null, user: null }) as never;
const caller = () => createCallerFactory(wikiosSisterRouter)(visitor());
const embed = jest.mocked(getSisterEmbed);

beforeEach(() => {
  embed.mockReset().mockResolvedValue({ status: "missing" });
});

async function codeOf(work: Promise<object>): Promise<string> {
  try {
    await work;
  } catch (error) {
    if (error instanceof TRPCError) return error.code;
    throw error;
  }
  throw new Error("the call succeeded");
}

describe("wikios.sisterEmbed", () => {
  it("asks for the whole page by default, with no section", async () => {
    expect(await caller().sisterEmbed({ wiki: "iiwiki", title: "Caphiria" })).toEqual({
      status: "missing",
    });
    expect(embed).toHaveBeenCalledWith(
      { wiki: "iiwiki", title: "Caphiria", mode: "page", section: null },
      expect.any(Function)
    );
  });

  it("passes a section in section mode only, and a section mode with no section reads the page", async () => {
    await caller().sisterEmbed({
      wiki: "althistory",
      title: "Main Page",
      mode: "section",
      section: "History",
    });
    await caller().sisterEmbed({
      wiki: "iiwiki",
      title: "Caphiria",
      mode: "card",
      section: "History",
    });
    await caller().sisterEmbed({ wiki: "iiwiki", title: "Caphiria", mode: "section" });
    await caller().sisterEmbed({
      wiki: "iiwiki",
      title: "Caphiria",
      mode: "section",
      section: " Rule ",
    });

    expect(embed.mock.calls.map((call) => call[0])).toEqual([
      { wiki: "althistory", title: "Main Page", mode: "section", section: "History" },
      { wiki: "iiwiki", title: "Caphiria", mode: "card", section: null },
      { wiki: "iiwiki", title: "Caphiria", mode: "page", section: null },
      { wiki: "iiwiki", title: "Caphiria", mode: "section", section: "Rule" },
    ]);
  });

  it("rejects ixwiki, an unknown wiki and a title with brackets", async () => {
    const bad = [
      { wiki: "ixwiki", title: "Caphiria" },
      { wiki: "commons", title: "Caphiria" },
      { wiki: "iiwiki", title: "[[Caphiria]]" },
      { wiki: "iiwiki", title: "" },
      { wiki: "iiwiki", title: "Caphiria", mode: "gallery" },
      { wiki: "iiwiki", title: "Caphiria", mode: "section", section: "x".repeat(256) },
      { wiki: "iiwiki", title: "Caphiria", mode: "section", section: "" },
      { wiki: "iiwiki", title: "Caphiria", mode: "section", section: "   " },
    ];
    for (const input of bad) {
      expect(await codeOf(caller().sisterEmbed(input as never))).toBe("BAD_REQUEST");
    }
    expect(embed).not.toHaveBeenCalled();
  });

  it("hands an unrenderable page back as it is", async () => {
    embed.mockResolvedValue({ status: "unrenderable" });
    expect(await caller().sisterEmbed({ wiki: "iiwiki", title: "Caphiria" })).toEqual({
      status: "unrenderable",
    });
  });

  it("an unreachable wiki is SERVICE_UNAVAILABLE", async () => {
    embed.mockRejectedValue(new WikiUnavailableError("IIWiki", "unreachable"));

    const error = await clientErrorOf(
      wikiosSisterRouter,
      "sisterEmbed",
      { wiki: "iiwiki", title: "Caphiria" },
      visitor()
    );

    expect(error).toEqual({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "IIWiki could not be reached just now.",
    });
  });

  it("each caller has a bucket of its own for its reads from the wiki: sisterembed, 20 a minute for a visitor; a cache hit is free", async () => {
    const { rateLimiter } = await import("~/lib/cache");
    jest.spyOn(rateLimiter, "isEnabled").mockReturnValue(true);
    const check = jest
      .spyOn(rateLimiter, "check")
      .mockResolvedValue({ success: true, remaining: 20, resetAt: new Date() } as never);
    try {
      await caller().sisterEmbed({ wiki: "iiwiki", title: "Caphiria" });
      expect(check).not.toHaveBeenCalled();

      embed.mockImplementation(async (_request, beforeRead) => {
        await beforeRead?.();
        return { status: "missing" };
      });
      await caller().sisterEmbed({ wiki: "iiwiki", title: "Caphiria" });
      expect(check).toHaveBeenCalledTimes(1);
      expect(check).toHaveBeenCalledWith(expect.anything(), "sisterembed", {
        maxRequests: 20,
        windowMs: 60_000,
      });
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("is merged into the wikios router", () => {
    expect(Object.keys(wikiosRouter._def.procedures)).toContain("sisterEmbed");
  });
});
