import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidate = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: { listMyShowcases: invalidate(), getShowcase: invalidate(), getMyDisplay: invalidate() },
    ixnayid: { getPassport: invalidate() },
  };
  return {
    api: {
      useUtils: () => utils,
      cards: {
        listMyShowcases: { useQuery: jest.fn() },
        addToShowcase: { useMutation: jest.fn() },
        createShowcase: { useMutation: jest.fn() },
      },
    },
  };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));

import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { AddToShowcaseDialog } from "~/components/cards/showcase/AddToShowcaseDialog";

interface MutationOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: { message: string }) => void;
}

const showcase = (overrides: Partial<{ id: string; name: string; itemCount: number }> = {}) => ({
  id: "s1",
  name: "Best of Ixnay",
  itemCount: 2,
  isPublic: true,
  pinned: false,
  description: null,
  cover: null,
  ...overrides,
});

const listed = (data: ReturnType<typeof showcase>[]) =>
  jest
    .mocked(api.cards.listMyShowcases.useQuery)
    .mockReturnValue({ data, isLoading: false } as never);

interface AddInput {
  showcaseId: string;
  ownershipIds: string[];
}
interface CreateInput {
  name: string;
  isPublic: boolean;
}

/** Each mutation calls `respond` with its options, standing in for the server. */
function mutations(respond: {
  add?: (options: MutationOptions<{ added: number }>) => void;
  create?: (options: MutationOptions<{ id: string }>) => void;
}) {
  const add = jest.fn();
  const create = jest.fn();
  jest.mocked(api.cards.addToShowcase.useMutation).mockImplementation(((
    options: MutationOptions<{ added: number }>
  ) => ({
    mutate: (input: AddInput) => {
      add(input);
      respond.add?.(options);
    },
    isPending: false,
  })) as never);
  jest.mocked(api.cards.createShowcase.useMutation).mockImplementation(((
    options: MutationOptions<{ id: string }>
  ) => ({
    mutate: (input: CreateInput) => {
      create(input);
      respond.create?.(options);
    },
    isPending: false,
  })) as never);
  return { add, create };
}

beforeEach(() => jest.clearAllMocks());

describe("AddToShowcaseDialog", () => {
  it("after a new showcase is made but the add fails, lists it and clears the name, so a second press makes no other", () => {
    listed([]);
    const { create } = mutations({
      create: (options) => options.onSuccess?.({ id: "s9" }),
      add: (options) => options.onError?.({ message: "A card you picked is no longer yours." }),
    });
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1"]} />);
    const name = screen.getByLabelText("New showcase name");
    fireEvent.change(name, { target: { value: "Firsts" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and add" }));
    expect(vaultNotify.error).toHaveBeenCalledWith("A card you picked is no longer yours.");
    expect(api.useUtils().cards.listMyShowcases.invalidate).toHaveBeenCalled();
    expect(name).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create and add" })).toBeDisabled();
    fireEvent.submit(name.closest("form") as HTMLFormElement);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
