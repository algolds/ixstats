import React from "react";
import { act, render } from "@testing-library/react";
import {
  attachIdFromAddress,
  PREFILL_MAX_FRAMES,
  useAttachPrefill,
} from "~/components/action-links/useAttachPrefill";

function Probe({ insert }: { insert: ((token: string) => boolean) | null }) {
  useAttachPrefill(insert);
  return null;
}

const FRAME = 16;
const frames = (n: number) =>
  act(() => {
    jest.advanceTimersByTime(FRAME * n);
  });
const go = (url: string) => window.history.replaceState(null, "", url);

describe("attachIdFromAddress", () => {
  it.each([
    ["?attach=dir-abc", "dir-abc"],
    ["?x=1&attach=a1", "a1"],
    ["", null],
    ["?attach=", null],
    ["?attach=%3Cscript%3E", null],
    [`?attach=${"a".repeat(65)}`, null],
    ["?attach=a%20b", null],
  ])("reads %j as %j", (search, expected) => {
    expect(attachIdFromAddress(search)).toBe(expected);
  });
});

describe("useAttachPrefill", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    go("/");
  });

  it("inserts the token once and removes only the attach parameter from the address", () => {
    go("/thinkpages/r/eurth?attach=dir-abc&x=1#top");
    const insert = jest.fn(() => true);
    const { rerender } = render(<Probe insert={insert} />);
    frames(2);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith("[ixaction=dir-abc]");
    expect(window.location.search).toBe("?x=1");
    expect(window.location.hash).toBe("#top");
    rerender(<Probe insert={insert} />);
    frames(2);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("does not insert again when the composer re-renders with a new callback", () => {
    go("/thinkpages/r/eurth?attach=a1");
    const first = jest.fn(() => true);
    const { rerender } = render(<Probe insert={first} />);
    frames(2);
    const second = jest.fn(() => true);
    go("/thinkpages/r/eurth?attach=a1");
    rerender(<Probe insert={second} />);
    frames(2);
    expect(second).not.toHaveBeenCalled();
  });

  it("waits for the editor to exist, then inserts", () => {
    go("/thinkpages/r/eurth?attach=a1");
    const insert = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    render(<Probe insert={insert} />);
    frames(5);
    expect(insert).toHaveBeenCalledTimes(3);
    expect(window.location.search).toBe("");
  });

  it("gives up after the frame limit and leaves the address alone", () => {
    go("/thinkpages/r/eurth?attach=a1");
    const insert = jest.fn(() => false);
    render(<Probe insert={insert} />);
    frames(PREFILL_MAX_FRAMES + 20);
    expect(insert).toHaveBeenCalledTimes(PREFILL_MAX_FRAMES);
    expect(window.location.search).toBe("?attach=a1");
  });

  it("stops asking when the composer goes away", () => {
    go("/thinkpages/r/eurth?attach=a1");
    const insert = jest.fn(() => false);
    const { unmount } = render(<Probe insert={insert} />);
    frames(2);
    unmount();
    const calls = insert.mock.calls.length;
    frames(10);
    expect(insert).toHaveBeenCalledTimes(calls);
  });

  it("does nothing for an id that is not shaped like one", () => {
    go(`/thinkpages/r/eurth?attach=${"a".repeat(65)}`);
    const insert = jest.fn(() => true);
    render(<Probe insert={insert} />);
    frames(3);
    expect(insert).not.toHaveBeenCalled();
  });

  it("does nothing without the parameter, or when the composer does not prefill", () => {
    go("/thinkpages/r/eurth");
    const insert = jest.fn(() => true);
    render(<Probe insert={insert} />);
    frames(3);
    expect(insert).not.toHaveBeenCalled();
    go("/thinkpages/r/eurth?attach=a1");
    render(<Probe insert={null} />);
    frames(3);
    expect(window.location.search).toBe("?attach=a1");
  });
});
