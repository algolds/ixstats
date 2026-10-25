/**
 * Plan 2026-10-24 Task 14 fix round 1 (M1): the editors' save (`useWikiEditorState.executeSave`) shows the server's
 * reason when it refused the save for one the author can act on, and the generic sentence otherwise.
 */
import { act, renderHook } from "@testing-library/react";
import { useWikiEditorState } from "~/components/wiki-os/editor/hooks/useWikiEditorState";

const mockNotifyError = jest.fn();
const mockNotifySuccess = jest.fn();

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
  }),
}));
jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({
  useWikiAuth: () => ({ isLoaded: true, isSignedIn: true, user: { id: "user_alice" } }),
}));
jest.mock("~/trpc/react", () => {
  const query = { useQuery: () => ({ data: undefined, isLoading: false }) };
  return {
    api: {
      wikios: { getStashes: query, getStashItems: query },
      commons: { getImageInfoByTitles: query },
    },
  };
});

const refused = (code: string, message: string) =>
  Object.assign(new Error(message), { data: { code } });

async function saveRejectedWith(error: Error): Promise<boolean> {
  const onSave = jest.fn().mockRejectedValue(error);
  const { result } = renderHook(() => useWikiEditorState({ title: "Vesperia", onSave }));
  let saved = true;
  await act(async () => {
    saved = await result.current.executeSave(() => "My text");
  });
  return saved;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("useWikiEditorState.executeSave refusals", () => {
  it("shows the server's sentence when the save limit refuses", async () => {
    const saved = await saveRejectedWith(
      refused("TOO_MANY_REQUESTS", "You are saving too fast. Wait a minute and try again.")
    );

    expect(saved).toBe(false);
    expect(mockNotifyError).toHaveBeenCalledWith(
      "Save Failed",
      "You are saving too fast. Wait a minute and try again."
    );
  });

  it("shows the server's sentence when the page was deleted meanwhile", async () => {
    await saveRejectedWith(
      refused("PRECONDITION_FAILED", "This page was deleted; ask an administrator to restore it")
    );

    expect(mockNotifyError).toHaveBeenCalledWith(
      "Save Failed",
      "This page was deleted; ask an administrator to restore it"
    );
  });

  it("keeps the generic sentence for anything else", async () => {
    await saveRejectedWith(refused("INTERNAL_SERVER_ERROR", "connect ECONNREFUSED db:5432"));

    expect(mockNotifyError).toHaveBeenCalledWith("Save Failed", "Could not save article changes.");
  });
});
