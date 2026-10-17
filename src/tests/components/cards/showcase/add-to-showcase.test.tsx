import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const invalidate = () => ({ invalidate: jest.fn() });
  const utils = {
    cards: { listMyShowcases: invalidate(), getShowcase: invalidate(), getMyDisplay: invalidate() },
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
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
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
  it("adds the picked copies to the chosen showcase", () => {
    listed([showcase()]);
    const { add } = mutations({});
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1", "o2"]} />);
    expect(screen.getByText("Pick a showcase for 2 cards.")).toBeInTheDocument();
    expect(screen.getByText("2 cards")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to Best of Ixnay" }));
    expect(add).toHaveBeenCalledWith({ showcaseId: "s1", ownershipIds: ["o1", "o2"] });
  });

  it("starts a first showcase when there is none, private, and adds to it", () => {
    listed([]);
    const { add, create } = mutations({ create: (options) => options.onSuccess?.({ id: "s9" }) });
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1"]} />);
    expect(screen.getByText("No showcases yet. Name one to start it.")).toBeInTheDocument();
    const name = screen.getByLabelText("New showcase name");
    expect(name).toHaveAttribute("maxLength", String(SHOWCASE_LIMITS.name));
    expect(screen.getByRole("button", { name: "Create and add" })).toBeDisabled();
    fireEvent.change(name, { target: { value: "  Firsts " } });
    fireEvent.click(screen.getByRole("button", { name: "Create and add" }));
    expect(create).toHaveBeenCalledWith({ name: "Firsts", isPublic: false });
    expect(add).toHaveBeenCalledWith({ showcaseId: "s9", ownershipIds: ["o1"] });
  });

  it("does not create a showcase with a blank name", () => {
    listed([]);
    const { create } = mutations({});
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1"]} />);
    const name = screen.getByLabelText("New showcase name");
    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.submit(name.closest("form") as HTMLFormElement);
    expect(create).not.toHaveBeenCalled();
  });

  it("says what was added, refreshes the showcases and closes", () => {
    listed([showcase()]);
    mutations({ add: (options) => options.onSuccess?.({ added: 1 }) });
    const onOpenChange = jest.fn();
    render(<AddToShowcaseDialog open onOpenChange={onOpenChange} ownershipIds={["o1"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to Best of Ixnay" }));
    expect(vaultNotify.success).toHaveBeenCalledWith("Added 1 card", "Best of Ixnay");
    const utils = api.useUtils();
    expect(utils.cards.listMyShowcases.invalidate).toHaveBeenCalled();
    expect(utils.cards.getShowcase.invalidate).toHaveBeenCalledWith({ showcaseId: "s1" });
    expect(utils.cards.getMyDisplay.invalidate).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("counts several cards, and says so when they were all there already", () => {
    listed([showcase()]);
    let added = 3;
    mutations({ add: (options) => options.onSuccess?.({ added }) });
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1", "o2", "o3"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to Best of Ixnay" }));
    expect(vaultNotify.success).toHaveBeenLastCalledWith("Added 3 cards", "Best of Ixnay");
    added = 0;
    fireEvent.click(screen.getByRole("button", { name: "Add to Best of Ixnay" }));
    expect(vaultNotify.success).toHaveBeenLastCalledWith(
      "Already in this showcase",
      "Best of Ixnay"
    );
  });

  it("shows the server's reason when adding fails, and stays open", () => {
    listed([showcase()]);
    mutations({
      add: (options) => options.onError?.({ message: "A card you picked is no longer yours." }),
    });
    const onOpenChange = jest.fn();
    render(<AddToShowcaseDialog open onOpenChange={onOpenChange} ownershipIds={["o1"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to Best of Ixnay" }));
    expect(vaultNotify.error).toHaveBeenCalledWith("A card you picked is no longer yours.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("lists a new showcase even when adding to it then fails, so a retry does not make another", () => {
    listed([]);
    mutations({
      create: (options) => options.onSuccess?.({ id: "s9" }),
      add: (options) => options.onError?.({ message: "A card you picked is no longer yours." }),
    });
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1"]} />);
    fireEvent.change(screen.getByLabelText("New showcase name"), { target: { value: "Firsts" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and add" }));
    expect(vaultNotify.error).toHaveBeenCalledWith("A card you picked is no longer yours.");
    expect(api.useUtils().cards.listMyShowcases.invalidate).toHaveBeenCalled();
  });

  it("will not overfill a showcase, and says how much room is left", () => {
    listed([
      showcase({ id: "full", name: "Full one", itemCount: SHOWCASE_LIMITS.items }),
      showcase({ id: "tight", name: "Tight", itemCount: SHOWCASE_LIMITS.items - 1 }),
      showcase({ id: "room", name: "Roomy", itemCount: SHOWCASE_LIMITS.items - 2 }),
    ]);
    mutations({});
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1", "o2"]} />);
    expect(screen.getByRole("button", { name: "Add to Full one" })).toBeDisabled();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Tight" })).toBeDisabled();
    expect(screen.getByText("Room for 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Roomy" })).toBeEnabled();
    expect(screen.getByText(`${SHOWCASE_LIMITS.items - 2} cards`)).toBeInTheDocument();
  });

  it("offers no new showcase once the player keeps the most allowed", () => {
    listed(
      Array.from({ length: SHOWCASE_LIMITS.perPlayer }, (_, i) =>
        showcase({ id: `s${i}`, name: `S${i}` })
      )
    );
    mutations({});
    render(<AddToShowcaseDialog open onOpenChange={jest.fn()} ownershipIds={["o1"]} />);
    expect(screen.queryByLabelText("New showcase name")).toBeNull();
    expect(
      screen.getByText(`You have ${SHOWCASE_LIMITS.perPlayer} showcases, the most you can keep.`)
    ).toBeInTheDocument();
  });

  it("asks for the showcases only while open", () => {
    listed([]);
    mutations({});
    render(<AddToShowcaseDialog open={false} onOpenChange={jest.fn()} ownershipIds={["o1"]} />);
    expect(api.cards.listMyShowcases.useQuery).toHaveBeenCalledWith(undefined, { enabled: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
