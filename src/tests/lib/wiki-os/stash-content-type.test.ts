import {
  isStashedArticle,
  isStashedForumThread,
  nativeThreadIdOf,
  stashContentTypeForTitle,
} from "~/lib/wiki-os/stash-content-type";

describe("forum threads in the stash", () => {
  it("types native and legacy thread titles as forum threads", () => {
    expect(stashContentTypeForTitle("thinkpages:thread:t1")).toBe("forum_thread");
    expect(stashContentTypeForTitle("forum:thread:7")).toBe("forum_thread");
    expect(stashContentTypeForTitle("commons:File.png")).toBe("image");
    expect(stashContentTypeForTitle("Rome")).toBe("wiki");
  });

  it("reads the thread id out of a native title only", () => {
    expect(nativeThreadIdOf("thinkpages:thread:t1")).toBe("t1");
    expect(nativeThreadIdOf("thinkpages:thread:")).toBeNull();
    expect(nativeThreadIdOf("forum:thread:7")).toBeNull();
  });

  it("keeps a native thread out of the articles and in the threads", () => {
    const native = { contentType: "forum_thread", pageTitle: "thinkpages:thread:t1" };
    const legacy = { contentType: "forum_thread", pageTitle: "forum:thread:7" };
    const article = { contentType: "wiki", pageTitle: "Rome" };
    const untyped = { pageTitle: "thinkpages:thread:t1" };

    expect([native, legacy, article, untyped].map(isStashedForumThread)).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect([native, legacy, article, untyped].map(isStashedArticle)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });
});
