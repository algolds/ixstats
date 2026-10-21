import { act, render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  MediaContextProvider,
  useIxMediaActions,
  useIxMediaTime,
} from "~/components/media/MediaContext";

type EngineHandler = (value: number) => void;

const mockEngineHandlers = new Map<string, EngineHandler>();

jest.mock("~/lib/media/IxMediaEngine", () => ({
  IxMediaEngine: class {
    addEventListener(event: string, callback: EngineHandler) {
      mockEngineHandlers.set(event, callback);
    }
    removeEventListener(event: string) {
      mockEngineHandlers.delete(event);
    }
    load() {}
    play() {
      return Promise.resolve();
    }
    pause() {}
    seek() {}
    setVolume() {}
    setSpeed() {}
  },
}));

let actionsRenders = 0;

function ActionsProbe() {
  useIxMediaActions();
  actionsRenders++;
  return null;
}

function TimeProbe() {
  return <span data-testid="time">{useIxMediaTime()}</span>;
}

function fireTimeUpdate(seconds: number) {
  act(() => {
    mockEngineHandlers.get("timeupdate")?.(seconds);
  });
}

describe("MediaContextProvider", () => {
  beforeEach(() => {
    actionsRenders = 0;
    mockEngineHandlers.clear();
    localStorage.clear();
  });

  it("re-renders time consumers on timeupdate without re-rendering action consumers", () => {
    render(
      <MediaContextProvider>
        <ActionsProbe />
        <TimeProbe />
      </MediaContextProvider>
    );
    const rendersAfterMount = actionsRenders;

    fireTimeUpdate(5);

    expect(screen.getByTestId("time").textContent).toBe("5");
    expect(actionsRenders).toBe(rendersAfterMount);
  });
});
