/** Politics › parties: deleting asks first, an edit sends no support figure, and a refused write says why. */
import { fireEvent, render, screen } from "@testing-library/react";
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/hooks/useScrollToFocus", () => ({ useScrollToFocus: jest.fn() }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    elections: {
      getParties: { useQuery: jest.fn() },
      createParty: { useMutation: jest.fn() },
      updateParty: { useMutation: jest.fn() },
      deleteParty: { useMutation: jest.fn() },
    },
  },
}));
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { PartyManager } from "~/components/executive/politics/PartyManager";

const party = {
  id: "p1",
  countryId: "c1",
  name: "Greens",
  shortName: null,
  ideology: "left",
  color: "#00aa00",
  leaderName: null,
  baseSupport: 20,
  currentSupport: 31.4,
  isActive: true,
};

const mutations = { create: jest.fn(), update: jest.fn(), delete: jest.fn() };
const options: Record<string, { onError?: (e: { message: string }) => void }> = {};

function renderManager() {
  jest
    .mocked(api.elections.getParties.useQuery)
    .mockReturnValue({ data: [party], refetch: jest.fn() } as never);
  for (const [key, hook] of [
    ["create", api.elections.createParty.useMutation],
    ["update", api.elections.updateParty.useMutation],
    ["delete", api.elections.deleteParty.useMutation],
  ] as const) {
    jest.mocked(hook).mockImplementation(((opts: (typeof options)[string]) => {
      options[key] = opts;
      return { mutate: mutations[key], isPending: false };
    }) as never);
  }
  jest.mocked(api.useUtils).mockReturnValue({
    elections: {
      getParties: { invalidate: jest.fn() },
      getCurrentParliament: { invalidate: jest.fn() },
      getElectionStatus: { invalidate: jest.fn() },
    },
  } as never);
  render(<PartyManager countryId="c1" />);
}

beforeAll(() => {
  // The support slider (Radix) measures itself
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});
beforeEach(() => jest.clearAllMocks());

it("deletes a party only after the confirmation", () => {
  renderManager();
  fireEvent.click(screen.getByRole("button", { name: "Delete Greens" }));
  expect(mutations.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(mutations.delete).toHaveBeenCalledWith({ id: "p1" });
});

it("an edit sends no currentSupport", () => {
  renderManager();
  fireEvent.click(screen.getByRole("button", { name: "Edit Greens" }));
  fireEvent.click(screen.getByRole("button", { name: "Update party" }));
  expect(mutations.update).toHaveBeenCalledTimes(1);
  expect(mutations.update.mock.calls[0][0]).not.toHaveProperty("currentSupport");
});

it("every party write reports a refusal", () => {
  renderManager();
  for (const key of ["create", "update", "delete"]) {
    options[key]!.onError!({ message: "FORBIDDEN" });
  }
  expect(useNotify().error).toHaveBeenCalledTimes(3);
});
