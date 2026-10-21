import { act, renderHook } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));

import { useSearchParams } from "next/navigation";
import { useCardSheet, useCardSheetOpen } from "~/hooks/useCardSheet";

const withParams = (query: string) =>
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never);

/** The browser's own `replaceState`, so a landing does not count as a call the hook made. */
const browserReplaceState = window.history.replaceState.bind(window.history);

/** Where `history.back()` lands: that entry's address and state, then the browser's popstate. */
function landOn(address: string, state: { __NA: boolean } | null) {
  browserReplaceState(state, "", address);
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
}

let pushState: jest.SpyInstance;
let back: jest.SpyInstance;

beforeEach(() => {
  window.history.replaceState(null, "", "/vault/cards/mine?realm=r1");
  pushState = jest.spyOn(window.history, "pushState");
  back = jest.spyOn(window.history, "back").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("useCardSheet", () => {
  it("goes back when it closes a sheet it opened, so Back does not open it again", () => {
    withParams("realm=r1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c2"));
    pushState.mockClear();
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("steps back once however often it is closed before the step back lands, then closes again later", () => {
    withParams("realm=r1");
    const { result, rerender } = renderHook(() => useCardSheet());
    act(() => result.current.open("c2"));
    act(() => {
      result.current.close();
      result.current.close();
    });
    expect(back).toHaveBeenCalledTimes(1);
    // The step back lands on the entry Next.js wrote, and the router follows.
    act(() => landOn("/vault/cards/mine?realm=r1", { __NA: true }));
    withParams("realm=r1&card=c3");
    rerender();
    window.history.replaceState(null, "", "/vault/cards/mine?realm=r1&card=c3");
    act(() => result.current.close());
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/vault/cards/mine?realm=r1");
  });
});

describe("useCardSheetOpen", () => {
  it.each([
    ["card=c1&from=offer.t1", true],
    ["realm=r1", false],
    ["card=", false],
  ])("for ?%s is %s", (query, open) => {
    withParams(query);
    expect(renderHook(() => useCardSheetOpen()).result.current).toBe(open);
  });
});
