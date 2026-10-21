/** The Loreward run console: saving a scored winner is the one action, and it announces. There is no Announce button. */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

interface MutationEntry {
  onSuccess?: (data: object) => void;
  mutate: jest.Mock;
  isPending: boolean;
}

// Every procedure answers: queries with no data, mutations with a recorded mutate (the latest render's, by path).
jest.mock("~/trpc/react", () => {
  const mutations = new Map<string, MutationEntry>();
  const procedure = (path: string) => ({
    useQuery: () => ({ data: undefined, isLoading: false, isFetching: false, refetch: jest.fn() }),
    useMutation: (options: Omit<MutationEntry, "mutate" | "isPending"> = {}) => {
      const entry = { ...options, mutate: jest.fn(), isPending: false };
      mutations.set(path, entry);
      return entry;
    },
  });
  const router = (name: string) =>
    new Proxy({}, { get: (_target, key: string) => procedure(`${name}.${key}`) });
  return {
    mutations,
    api: new Proxy({}, { get: (_target, key: string) => router(key) }),
  };
});
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});

import { LorewardsBotSection } from "~/app/admin/_components/platform/LorewardsBotSection";
import { useNotify } from "~/hooks/useNotify";

const { mutations } = jest.requireMock<{ mutations: Map<string, MutationEntry> }>("~/trpc/react");
const mutation = (path: string) => {
  const entry = mutations.get(path);
  if (!entry) throw new Error(`No mutation ${path}`);
  return entry;
};

const winner = { user: "Cy", page: "Kingdom of Hive", finalScore: 91, bytesAdded: 4096 };

function scored() {
  render(<LorewardsBotSection />);
  act(() =>
    mutation("admin.triggerLorewardScoring").onSuccess?.({
      date: "2026-10-16",
      winner,
      runnerUp: null,
      candidates: [],
      editCount: 12,
    })
  );
}

describe("Loreward run console", () => {
  it("saves the scored winner with one button that announces, and offers no separate Announce", () => {
    scored();
    expect(screen.queryByRole("button", { name: /^Announce/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save and announce winner" }));
    expect(mutation("admin.saveLorewardWinnerOverride").mutate).toHaveBeenCalledWith(
      expect.objectContaining({ winnerUser: "Cy", winnerPage: "Kingdom of Hive", winnerScore: 91 })
    );
  });

  it("says the save stands but nothing was announced when the bot was not told", () => {
    scored();
    act(() =>
      mutation("admin.saveLorewardWinnerOverride").onSuccess?.({
        botSynced: false,
        reassigned: 0,
        voided: 0,
        mintDeferred: false,
      })
    );
    expect(useNotify().warning).toHaveBeenCalledWith(
      "Saved",
      "The Discord bot was not told, so nothing was announced. It picks the change up on its next sync."
    );
  });
});
