import { act, renderHook } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));

import { useSearchParams } from "next/navigation";
import { useCardSheet } from "~/hooks/useCardSheet";

const withParams = (query: string) =>
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never);

let pushState: jest.SpyInstance;
let back: jest.SpyInstance;

beforeEach(() => {
  window.history.replaceState(null, "", "/vault/cards/mine?realm=r1");
  pushState = jest.spyOn(window.history, "pushState");
  back = jest.spyOn(window.history, "back").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("useCardSheet", () => {
  it("reads the open card and where it was opened from", () => {
    withParams("card=c1&from=offer.t1");
    const { result } = renderHook(() => useCardSheet());
    expect(result.current.cardId).toBe("c1");
    expect(result.current.from).toEqual({ kind: "offer", id: "t1" });
  });

  it("has no card for a missing or empty ?card=, and no place for a malformed ?from=", () => {
    withParams("card=&from=nonsense");
    const { result } = renderHook(() => useCardSheet());
    expect(result.current.cardId).toBeNull();
    expect(result.current.from).toBeNull();
  });

  it("opens and closes the sheet in the address bar, keeping the page's own query", () => {
    withParams("realm=r1");
    const { result } = renderHook(() => useCardSheet());
    expect(result.current.cardId).toBeNull();
    act(() => result.current.open("c2", { kind: "holder", handle: "ann" }));
    expect(pushState).toHaveBeenLastCalledWith(
      expect.anything(),
      "",
      "/vault/cards/mine?realm=r1&card=c2&from=holder.ann"
    );
    // A copied link: this page did not open the sheet, so closing writes the address without it.
    window.history.replaceState(null, "", "/vault/cards/mine?realm=r1&card=c2&from=holder.ann");
    act(() => result.current.close());
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/vault/cards/mine?realm=r1");
    expect(back).not.toHaveBeenCalled();
  });

  it("drops a stale ?from= when a card opens without one, and keeps the hash", () => {
    window.history.replaceState(null, "", "/vault/cards/mine?from=offer.t1#top");
    withParams("from=offer.t1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c3"));
    expect(pushState).toHaveBeenLastCalledWith(
      expect.anything(),
      "",
      "/vault/cards/mine?card=c3#top"
    );
  });

  it("goes back when it closes a sheet it opened, so Back does not open it again", () => {
    withParams("realm=r1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c2"));
    pushState.mockClear();
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("writes a bare path when nothing is left of the query", () => {
    window.history.replaceState(null, "", "/vault/cards/explore?card=c1");
    withParams("card=c1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.close());
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/vault/cards/explore");
  });
});
