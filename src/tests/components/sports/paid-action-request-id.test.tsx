/**
 * A paid MyClub button sends one request id per press: a retry of the same attempt (after a failure, or a
 * re-submitted form) reuses it, so the server charges it once; a success, or other inputs, start a new one.
 */
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

type MutationOptions = { onSuccess?: () => void };
const mutate = jest.fn();
let teamTrainingOptions: MutationOptions = {};

jest.mock("~/trpc/react", () => ({
  api: {
    sports: {
      teamTraining: {
        useMutation: (options: MutationOptions) => {
          teamTrainingOptions = options;
          return { mutate, isPending: false };
        },
      },
    },
  },
}));

import {
  usePaidActionRequestId,
  usePaidMutateAsync,
} from "~/components/sports/core/usePaidActionRequestId";
import { TeamTrainingButton } from "~/components/sports/club/TeamTrainingButton";

beforeEach(() => mutate.mockReset());

describe("usePaidActionRequestId", () => {
  it("keeps one id per attempt until it is done", () => {
    const { result, rerender } = renderHook(() => usePaidActionRequestId());
    const first = result.current.idFor("team-1");
    rerender();

    expect(result.current.idFor("team-1")).toBe(first);
    expect(first.length).toBeGreaterThanOrEqual(8);
    const other = result.current.idFor("team-2");
    expect(other).not.toBe(first);

    result.current.done();
    expect(result.current.idFor("team-2")).not.toBe(other);
  });
});

describe("usePaidMutateAsync", () => {
  it("resends a failed submission's id, and starts a new one after a success or an edit", async () => {
    const mutateAsync = jest
      .fn<Promise<{ id: string }>, [{ name: string; requestId?: string }]>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ id: "league-1" });
    const { result } = renderHook(() => usePaidMutateAsync(mutateAsync));
    const ids = () => mutateAsync.mock.calls.map(([input]) => input.requestId);

    await act(async () => {
      await expect(result.current({ name: "League" })).rejects.toThrow("network");
      await result.current({ name: "League" });
      await result.current({ name: "League" });
      await result.current({ name: "Other league" });
    });

    const [failed, retried, again, edited] = ids();
    expect(retried).toBe(failed);
    expect(again).not.toBe(retried);
    expect(edited).not.toBe(again);
    expect(mutateAsync.mock.calls[0]![0]).toMatchObject({ name: "League" });
  });
});

describe("TeamTrainingButton", () => {
  it("sends the same id until the session succeeds", () => {
    render(<TeamTrainingButton teamId="team-1" playerCount={11} />);
    const press = () => fireEvent.click(screen.getByRole("button", { name: /team training/i }));
    const sent = () =>
      mutate.mock.calls.map(([input]) => input as { teamId: string; requestId: string });

    press();
    press(); // the first press failed (no success), so this is its retry
    act(() => teamTrainingOptions.onSuccess?.());
    press();

    const [first, retry, next] = sent();
    expect(first).toEqual({ teamId: "team-1", requestId: expect.any(String) });
    expect(retry!.requestId).toBe(first!.requestId);
    expect(next!.requestId).not.toBe(first!.requestId);
  });
});
