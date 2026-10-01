/** @jest-environment node */
/** Plan 410: api.php parameter parsing (query + body, multi-values, limits, flags, timestamps). */
import { ApiError } from "~/lib/wiki-os/api-compat/errors";
import {
  ApiParams,
  HIGH_LIMIT,
  NORMAL_LIMIT,
  parseRequestParams,
  splitMultiValue,
} from "~/lib/wiki-os/api-compat/params";

const params = (query: string, warn = jest.fn()) => ({
  p: ApiParams.from(new URLSearchParams(query).entries(), warn),
  warn,
});

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof ApiError ? error.code : "other";
  }
  return undefined;
}

describe("splitMultiValue", () => {
  it("splits on | and treats the empty string as no values", () => {
    expect(splitMultiValue("a|b|c")).toEqual(["a", "b", "c"]);
    expect(splitMultiValue("")).toEqual([]);
    expect(splitMultiValue("single")).toEqual(["single"]);
  });

  it("uses U+001F as the separator when the value starts with it, so a value may hold a pipe", () => {
    expect(splitMultiValue("\u001fa|b\u001fc")).toEqual(["a|b", "c"]);
  });
});

describe("ApiParams", () => {
  it("lets a POST body override the query string", () => {
    const merged = parseRequestParams(new URLSearchParams("a=1&b=2"), [["a", "3"]]);
    expect(merged.string("a")).toBe("3");
    expect(merged.string("b")).toBe("2");
  });

  it("reads module parameters through a prefix", () => {
    const { p } = params("aplimit=7&apfrom=Foo&limit=99");
    const scoped = p.scope("ap", "allpages");
    expect(scoped.integer("limit", { fallback: 10 })).toBe(7);
    expect(scoped.string("from")).toBe("Foo");
    expect(scoped.fullName("from")).toBe("apfrom");
  });

  it("treats a flag as true whenever the parameter is present, whatever its value", () => {
    const { p } = params("minor=&bot=0");
    expect(p.flag("minor")).toBe(true);
    expect(p.flag("bot")).toBe(true);
    expect(p.flag("createonly")).toBe(false);
  });

  it("reports a missing required parameter", () => {
    const { p } = params("");
    expect(codeOf(() => p.required("title"))).toBe("missingparam");
  });

  describe("integer and limit", () => {
    it("rejects non-numbers with badinteger", () => {
      const { p } = params("aplimit=abc");
      expect(codeOf(() => p.scope("ap", "allpages").integer("limit", { fallback: 10 }))).toBe(
        "badinteger"
      );
    });

    it("answers `max` with 500, or 5000 for apihighlimits", () => {
      const { p } = params("aplimit=max");
      const scoped = p.scope("ap", "allpages");
      expect(scoped.limit("limit", { fallback: 10, high: false })).toBe(NORMAL_LIMIT);
      expect(scoped.limit("limit", { fallback: 10, high: true })).toBe(HIGH_LIMIT);
    });

    it("caps an explicit number at the caller's limit and warns", () => {
      const { p, warn } = params("aplimit=9000");
      const scoped = p.scope("ap", "allpages");
      expect(scoped.limit("limit", { fallback: 10, high: false })).toBe(500);
      expect(warn).toHaveBeenCalledWith("allpages", expect.stringContaining("aplimit"));
      expect(scoped.limit("limit", { fallback: 10, high: true })).toBe(5000);
    });

    it("raises a limit below 1 to 1 and uses the fallback when absent", () => {
      const { p } = params("aplimit=0");
      const scoped = p.scope("ap", "allpages");
      expect(scoped.limit("limit", { fallback: 10, high: false })).toBe(1);
      expect(params("").p.limit("limit", { fallback: 10, high: false })).toBe(10);
    });
  });

  describe("lists", () => {
    it("returns the values, and refuses more than the limit with toomanyvalues", () => {
      const { p } = params("titles=A|B|C");
      expect(p.list("titles")).toEqual(["A", "B", "C"]);
      expect(codeOf(() => p.list("titles", 2))).toBe("toomanyvalues");
    });

    it("validates enumerated values with badvalue", () => {
      const { p } = params("siprop=general|nope");
      expect(codeOf(() => p.listOf("siprop", ["general", "namespaces"]))).toBe("badvalue");
      expect(params("siprop=general").p.listOf("siprop", ["general", "namespaces"])).toEqual([
        "general",
      ]);
      expect(params("").p.listOf("siprop", ["general", "namespaces"], ["general"])).toEqual([
        "general",
      ]);
    });

    it("validates a single enumerated value", () => {
      expect(params("dir=newer").p.oneOf("dir", ["older", "newer"], "older")).toBe("newer");
      expect(params("").p.oneOf("dir", ["older", "newer"], "older")).toBe("older");
      expect(codeOf(() => params("dir=up").p.oneOf("dir", ["older", "newer"], "older"))).toBe(
        "badvalue"
      );
    });
  });

  describe("timestamp", () => {
    const now = new Date("2026-09-30T00:00:00Z");

    it("reads ISO 8601, the 14-digit form and `now`", () => {
      expect(params("t=2026-01-02T03:04:05Z").p.timestamp("t", now)?.toISOString()).toBe(
        "2026-01-02T03:04:05.000Z"
      );
      expect(params("t=20260102030405").p.timestamp("t", now)?.toISOString()).toBe(
        "2026-01-02T03:04:05.000Z"
      );
      expect(params("t=now").p.timestamp("t", now)).toBe(now);
      expect(params("").p.timestamp("t", now)).toBeUndefined();
    });

    it("rejects anything else with badtimestamp", () => {
      expect(codeOf(() => params("t=yesterday").p.timestamp("t", now))).toBe("badtimestamp");
    });
  });
});
