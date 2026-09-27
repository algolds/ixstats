import { act, render } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { IxTimeProvider } from "~/context/IxTimeContext";

let visibility: DocumentVisibilityState = "visible";
const originalFetch = global.fetch;
const fetchMock = jest.fn(() => Promise.resolve({ ok: false } as Response));

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("IxTimeProvider visibility gating", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    global.fetch = fetchMock as typeof fetch;
    fetchMock.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("does not fetch while the tab is hidden", () => {
    render(
      <IxTimeProvider>
        <div />
      </IxTimeProvider>
    );

    setVisibility("hidden");
    fetchMock.mockClear();
    act(() => {
      jest.advanceTimersByTime(120_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resyncs immediately when the tab becomes visible again", () => {
    render(
      <IxTimeProvider>
        <div />
      </IxTimeProvider>
    );

    setVisibility("hidden");
    fetchMock.mockClear();
    setVisibility("visible");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
