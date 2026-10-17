import { act, renderHook } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));

import { useSearchParams } from "next/navigation";
import { useCardSheet } from "~/hooks/useCardSheet";

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

  it("closes a sheet opened from an entry Next.js does not follow, such as the skip link's", () => {
    window.history.replaceState(null, "", "/vault/cards/mine?realm=r1#main");
    withParams("realm=r1");
    const { result, rerender } = renderHook(() => useCardSheet());
    act(() => result.current.open("c2"));
    withParams("realm=r1&card=c2");
    rerender();
    back.mockImplementation(() => landOn("/vault/cards/mine?realm=r1#main", null));
    const replaceState = jest.spyOn(window.history, "replaceState");
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
    // The router kept ?card=, so the hook tells it where the browser is: through Next's history patch, it follows.
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/vault/cards/mine?realm=r1#main");
    // Nor is the guard left set: should the router still show the card, a close writes the address again.
    pushState.mockClear();
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/vault/cards/mine?realm=r1#main");
  });

  it("leaves a step back Next.js follows to the router, and pushes nothing before the router catches up", () => {
    withParams("realm=r1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c2"));
    back.mockImplementation(() => landOn("/vault/cards/mine?realm=r1", { __NA: true }));
    const replaceState = jest.spyOn(window.history, "replaceState");
    act(() => result.current.close());
    expect(replaceState).not.toHaveBeenCalled();
    pushState.mockClear();
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("leaves a step back it did not make to the router", () => {
    withParams("realm=r1&card=c2");
    renderHook(() => useCardSheet());
    const replaceState = jest.spyOn(window.history, "replaceState");
    act(() => landOn("/vault/cards/mine?realm=r1#main", null));
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("is free to close again once the page comes back from the browser's page cache", () => {
    withParams("realm=r1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c2"));
    act(() => result.current.close());
    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });
    act(() => result.current.close());
    expect(back).toHaveBeenCalledTimes(2);
  });

  it("opens nothing new when the address already shows that card from that place", () => {
    window.history.replaceState(null, "", "/vault/cards/mine?card=c1&from=offer.t1");
    withParams("card=c1&from=offer.t1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c1", { kind: "offer", id: "t1" }));
    expect(pushState).not.toHaveBeenCalled();
    act(() => result.current.open("c1"));
    expect(pushState).toHaveBeenLastCalledWith(expect.anything(), "", "/vault/cards/mine?card=c1");
    act(() => result.current.open("c2", { kind: "offer", id: "t1" }));
    expect(pushState).toHaveBeenLastCalledWith(
      expect.anything(),
      "",
      "/vault/cards/mine?card=c2&from=offer.t1"
    );
  });

  it("pushes one address however often a linked-in sheet is closed before the address changes", () => {
    window.history.replaceState(null, "", "/vault/cards/explore?card=c1");
    withParams("card=c1");
    const { result } = renderHook(() => useCardSheet());
    act(() => {
      result.current.close();
      result.current.close();
    });
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("does not take a state Next.js or another page wrote for its own marker", () => {
    withParams("card=c1");
    for (const state of [{ cardSheetOpened: "yes" }, { __NA: true }, "cardSheetOpened", 7]) {
      window.history.replaceState(state, "", "/vault/cards/mine?card=c1");
      const { result, unmount } = renderHook(() => useCardSheet());
      act(() => result.current.close());
      unmount();
    }
    expect(back).not.toHaveBeenCalled();
    expect(pushState).toHaveBeenCalledTimes(4);
  });

  it("writes a bare path when nothing is left of the query", () => {
    window.history.replaceState(null, "", "/vault/cards/explore?card=c1");
    withParams("card=c1");
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.close());
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/vault/cards/explore");
  });
});
