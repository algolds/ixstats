import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { api } from "~/trpc/react";
import { useGlassCanvasComposer } from "~/components/thinkpages/composer/useGlassCanvasComposer";

// `~/trpc/react` is the jest-mocks proxy: every useMutation returns a jest.fn() `mutate`.
const createPostMutation = () =>
  (api.thinkpages.createPost.useMutation as unknown as jest.Mock).mock.results.at(-1)!.value as {
    mutate: jest.Mock;
  };

const account = { id: "acct_1", accountType: "government", displayName: "Gov" };

describe("useGlassCanvasComposer reposts", () => {
  beforeEach(() => {
    (api.thinkpages.createPost.useMutation as unknown as jest.Mock).mockClear();
  });

  it("posts a wiki article repost without a fake repostOfId, carrying the article link", () => {
    const { result } = renderHook(() =>
      useGlassCanvasComposer({
        account,
        countryId: "c1",
        isOwner: true,
        onPost: () => {},
        repostData: {
          mode: "repost",
          originalPost: { id: "wiki-Caphiria", content: "[blurb:wiki/Caphiria|Caphiria]" },
        },
      })
    );

    act(() => result.current.handleSubmit());

    const payload = createPostMutation().mutate.mock.calls[0]![0] as {
      repostOfId?: string;
      content: string;
    };
    expect(payload.repostOfId).toBeUndefined();
    expect(payload.content).toContain("[blurb:wiki/Caphiria|Caphiria]");
  });

  it("keeps repostOfId for a ThinkPages post repost, even with no comment", () => {
    const { result } = renderHook(() =>
      useGlassCanvasComposer({
        account,
        countryId: "c1",
        isOwner: true,
        onPost: () => {},
        repostData: { mode: "repost", originalPost: { id: "post_123" } },
      })
    );

    act(() => result.current.handleSubmit());

    const payload = createPostMutation().mutate.mock.calls[0]![0] as { repostOfId?: string };
    expect(payload.repostOfId).toBe("post_123");
  });
});
