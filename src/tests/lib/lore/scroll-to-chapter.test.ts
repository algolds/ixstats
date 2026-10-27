import { scrollToChapter } from "~/lib/lore/scroll-to-chapter";

/** A chapter whose top sits `top()` px below the viewport's top, with a 72px scroll margin. */
function chapterAt(top: () => number) {
  const chapter = document.createElement("section");
  chapter.style.scrollMarginTop = "72px";
  chapter.getBoundingClientRect = () => ({ top: top() }) as DOMRect;
  const scrollIntoView = jest.fn();
  chapter.scrollIntoView = scrollIntoView;
  document.body.append(chapter);
  return { chapter, scrollIntoView };
}

const scrollEnd = () => window.dispatchEvent(new Event("scrollend"));

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = "";
});

describe("scrollToChapter", () => {
  it("scrolls the chapter to the top at once, with the behaviour given", () => {
    const { chapter, scrollIntoView } = chapterAt(() => 900);
    scrollToChapter(chapter, "smooth");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("scrolls again when the scroll ends short, because pieces above loaded and the page grew", () => {
    let top = 2255;
    const { chapter, scrollIntoView } = chapterAt(() => top);
    scrollToChapter(chapter, "auto");
    scrollEnd();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "start" });
    top = 72;
    scrollEnd();
    scrollEnd();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("counts a chapter within two pixels of its scroll margin as there", () => {
    const { chapter, scrollIntoView } = chapterAt(() => 74);
    scrollToChapter(chapter, "smooth");
    scrollEnd();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("tries again at most three times", () => {
    const { chapter, scrollIntoView } = chapterAt(() => 500);
    scrollToChapter(chapter, "smooth");
    for (let i = 0; i < 6; i++) scrollEnd();
    expect(scrollIntoView).toHaveBeenCalledTimes(4);
  });

  it.each(["wheel", "touchstart", "keydown", "pointerdown"])(
    "leaves the page alone once the reader scrolls themselves (%s)",
    (type) => {
      const { chapter, scrollIntoView } = chapterAt(() => 500);
      scrollToChapter(chapter, "smooth");
      window.dispatchEvent(new Event(type));
      scrollEnd();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    }
  );

  it("gives up after four seconds, so a later scroll of the reader's is never pulled back", () => {
    jest.useFakeTimers();
    const { chapter, scrollIntoView } = chapterAt(() => 500);
    scrollToChapter(chapter, "smooth");
    jest.advanceTimersByTime(3999);
    scrollEnd();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1);
    scrollEnd();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
