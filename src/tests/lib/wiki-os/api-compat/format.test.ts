/** @jest-environment node */
/** Plan 410: v1/v2 serialisation, the error envelope, warnings and continuation. */
import {
  Continuation,
  decodeCursor,
  encodeCursor,
  optionalCursor,
  takePage,
} from "~/lib/wiki-os/api-compat/continuation";
import { ApiError, badContinue } from "~/lib/wiki-os/api-compat/errors";
import {
  API_DOCREF,
  ResponseBuilder,
  errorBody,
  mwTimestamp,
  toWire,
  wrapText,
} from "~/lib/wiki-os/api-compat/format";

describe("toWire", () => {
  const result = {
    query: {
      pages: [{ title: "A", missing: true, redirect: false, content: { ns: 0 } }],
      skipped: undefined,
    },
    batchcomplete: true,
  };

  it("formatversion=1 shows a true boolean as the empty string and leaves a false one out", () => {
    expect(toWire(result, 1)).toEqual({
      query: { pages: [{ title: "A", missing: "", content: { ns: 0 } }] },
      batchcomplete: "",
    });
  });

  it("formatversion=2 keeps booleans and still drops undefined", () => {
    expect(toWire(result, 2)).toEqual({
      query: { pages: [{ title: "A", missing: true, redirect: false, content: { ns: 0 } }] },
      batchcomplete: true,
    });
  });

  it("leaves strings, numbers and null alone", () => {
    expect(toWire({ a: "x", b: 1, c: null }, 1)).toEqual({ a: "x", b: 1, c: null });
  });
});

describe("wrapText", () => {
  it("wraps text in {\"*\": ...} for v1 and returns it plain for v2", () => {
    expect(wrapText("hi", 1)).toEqual({ "*": "hi" });
    expect(wrapText("hi", 2)).toBe("hi");
  });
});

describe("timestamps", () => {
  it("formats ISO to the second, without fractions", () => {
    expect(mwTimestamp(new Date("2026-09-30T12:34:56.789Z"))).toBe("2026-09-30T12:34:56Z");
  });
});

describe("errorBody", () => {
  const error = new ApiError("badtoken", "Invalid CSRF token.");

  it("answers the bc envelope by default, for both format versions", () => {
    const expected = { error: { code: "badtoken", info: "Invalid CSRF token.", "*": API_DOCREF } };
    expect(errorBody(error, 1)).toEqual(expected);
    expect(errorBody(error, 2)).toEqual(expected);
  });

  it("answers the errors array for the newer error formats", () => {
    expect(errorBody(error, 2, "plaintext")).toEqual({
      errors: [{ code: "badtoken", text: "Invalid CSRF token.", module: "main" }],
      docref: API_DOCREF,
    });
    expect(errorBody(error, 1, "wikitext")).toEqual({
      errors: [{ code: "badtoken", "*": "Invalid CSRF token.", module: "main" }],
      docref: API_DOCREF,
    });
  });
});

describe("ResponseBuilder", () => {
  it("adds warnings per module in the version's shape and de-duplicates them", () => {
    const builder = new ResponseBuilder();
    builder.addWarning("main", "Unrecognized parameter: foo.");
    builder.addWarning("main", "Unrecognized parameter: foo.");
    builder.addWarning("query", "Be careful.");
    expect(builder.finish({ ok: true }, 2)).toEqual({
      ok: true,
      warnings: { main: { warnings: "Unrecognized parameter: foo." }, query: { warnings: "Be careful." } },
    });
    expect(builder.finish({ ok: true }, 1).warnings).toEqual({
      main: { "*": "Unrecognized parameter: foo." },
      query: { "*": "Be careful." },
    });
  });

  it("adds no warnings key when there are none", () => {
    expect(new ResponseBuilder().finish({ ok: true }, 2)).toEqual({ ok: true });
  });
});

describe("cursors", () => {
  it("round-trips parts that hold the separator and non-ASCII text", () => {
    const raw = encodeCursor(["Foo|Bar é", 42]);
    expect(raw.split("|")).toHaveLength(2);
    expect(decodeCursor(raw, ["s", "n"] as const)).toEqual(["Foo|Bar é", 42]);
  });

  it("refuses a malformed cursor with badcontinue", () => {
    expect(() => decodeCursor("only-one", ["s", "n"] as const)).toThrow(badContinue().message);
    expect(() => decodeCursor("a|notanumber", ["s", "n"] as const)).toThrow(ApiError);
    expect(() => decodeCursor("%E0%A4%A|1", ["s", "n"] as const)).toThrow(ApiError);
  });

  it("reads an absent cursor as undefined", () => {
    expect(optionalCursor(undefined, ["s"] as const)).toBeUndefined();
    expect(optionalCursor("", ["s"] as const)).toBeUndefined();
    expect(optionalCursor("x", ["s"] as const)).toEqual(["x"]);
  });
});

describe("takePage", () => {
  it("cuts the extra fetched row and reports more", () => {
    expect(takePage([1, 2, 3], 2)).toEqual({ page: [1, 2], more: true });
    expect(takePage([1, 2], 2)).toEqual({ page: [1, 2], more: false });
  });
});

describe("Continuation", () => {
  it("says batchcomplete and nothing else when nothing continues", () => {
    expect(new Continuation().toResult()).toEqual({ batchcomplete: true });
  });

  it("continues a list with the generic -|| marker and still reports batchcomplete", () => {
    const continuation = new Continuation();
    continuation.add("apcontinue", "Foo");
    expect(continuation.toResult()).toEqual({
      batchcomplete: true,
      continue: { apcontinue: "Foo", continue: "-||" },
    });
  });

  it("withholds batchcomplete while a prop has more for the current page set", () => {
    const continuation = new Continuation();
    continuation.addProp("rvcontinue", "20260930123456|7");
    expect(continuation.toResult()).toEqual({
      continue: { rvcontinue: "20260930123456|7", continue: "||" },
    });
  });

  it("names the generator in the marker", () => {
    const continuation = new Continuation();
    continuation.addGenerator("gapcontinue", "Foo");
    expect(continuation.toResult()).toEqual({
      batchcomplete: true,
      continue: { gapcontinue: "Foo", continue: "gapcontinue||" },
    });
  });
});
