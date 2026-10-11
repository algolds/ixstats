import { act, renderHook } from "@testing-library/react";
import { useScrollToMessageHash } from "~/components/thinkpages-forum/realm/useScrollToMessageHash";

const scrollIntoView = jest.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
  document.body.innerHTML = '<article id="post-old"></article><article id="post-new"></article>';
  window.location.hash = "";
});
afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  document.body.innerHTML = "";
});

describe("useScrollToMessageHash", () => {
  it("looks for nothing without a message link", () => {
    const { result } = renderHook(() => useScrollToMessageHash());
    expect(result.current).toBeNull();
  });

  it("asks the feed to find the message of the link, and scrolls to it once the feed has it", () => {
    window.location.hash = "#post-old";
    const { result } = renderHook(() => useScrollToMessageHash());
    expect(result.current?.postId).toBe("old");
    act(() => result.current?.found());
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("post-old"));
  });

  it("scrolls once per link: a refetch or a new message leaves the reader where they are", () => {
    window.location.hash = "#post-old";
    const { result } = renderHook(() => useScrollToMessageHash());
    act(() => result.current?.found());
    act(() => result.current?.found());
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("follows a link clicked on the page, such as Replying to", () => {
    window.location.hash = "#post-old";
    const { result } = renderHook(() => useScrollToMessageHash());
    act(() => result.current?.found());
    act(() => {
      window.location.hash = "#post-new";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current?.postId).toBe("new");
    act(() => result.current?.found());
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("ignores a hash that is not a message", () => {
    window.location.hash = "#top";
    const { result } = renderHook(() => useScrollToMessageHash());
    expect(result.current).toBeNull();
  });
});
