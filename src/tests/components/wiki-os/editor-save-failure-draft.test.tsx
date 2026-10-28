/**
 * A save that fails keeps the work as a local draft, in either editor. The canvas did; the source editor did not, so
 * a failed save followed by a closed tab lost the text.
 */
import { act, renderHook } from "@testing-library/react";
import { useWikiEditorState } from "~/components/wiki-os/editor/hooks/useWikiEditorState";
import { getDraft } from "~/lib/wiki-os/editor/draft-store";

jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isLoaded: true, isSignedIn: true, user: { id: "user_alice" } }),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => {
  const idle = { useQuery: () => ({ data: undefined }) };
  return {
    api: {
      wikios: { getStashes: idle, getStashItems: idle },
      commons: { getImageInfoByTitles: idle },
    },
  };
});

const setup = (onSave: jest.Mock) =>
  renderHook(() => useWikiEditorState({ title: "Vesperia", onSave }));

describe("useWikiEditorState: a failed save keeps a draft", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the source text as a draft when the save fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup(jest.fn().mockRejectedValue(new Error("offline")));
    let saved = true;
    await act(async () => {
      saved = await result.current.executeSave(() => "My source text", "source");
    });
    expect(saved).toBe(false);
    expect(getDraft("user_alice", "Vesperia")).toMatchObject({
      wikitext: "My source text",
      mode: "source",
    });
  });

  it("writes no draft when the save succeeds", async () => {
    const { result } = setup(jest.fn().mockResolvedValue(undefined));
    await act(async () => {
      await result.current.executeSave(() => "Published", "source");
    });
    expect(getDraft("user_alice", "Vesperia")).toBeNull();
  });
});
