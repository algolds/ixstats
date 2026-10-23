/** The handle picker a player without a passport handle meets on their first WikiOS save (design decision 9). */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    ixnayid: {
      suggestHandle: { useQuery: jest.fn() },
      setHandle: { useMutation: jest.fn() },
    },
  },
}));

import { api } from "~/trpc/react";
import { HandlePickerDialog } from "~/components/wiki-os/editor/HandlePickerDialog";

interface MutationOptions {
  onSuccess: (result: { handle: string }) => Promise<void>;
  onError: (error: { message: string }) => void;
}

const invalidateStatus = jest.fn();

/** Mocks `setHandle` and hands back its options, so a test can answer as the server would. */
function mockSetHandle() {
  const mutate = jest.fn();
  const options: { current?: MutationOptions } = {};
  jest.mocked(api.ixnayid.setHandle.useMutation).mockImplementation(((opts: MutationOptions) => {
    options.current = opts;
    return { mutate, isPending: false };
  }) as never);
  return { mutate, options };
}

function renderDialog(suggestion: string | null = "old_name_2") {
  jest
    .mocked(api.ixnayid.suggestHandle.useQuery)
    .mockReturnValue({ data: { handle: suggestion } } as never);
  const onDone = jest.fn();
  const onCancel = jest.fn();
  render(<HandlePickerDialog open onDone={onDone} onCancel={onCancel} />);
  return { onDone, onCancel };
}

beforeEach(() => {
  jest.clearAllMocks();
  invalidateStatus.mockResolvedValue(undefined);
  jest
    .mocked(api.useUtils)
    .mockReturnValue({ ixnayid: { getStatus: { invalidate: invalidateStatus } } } as never);
});

it("asks for a handle, prefilled with the suggestion", () => {
  mockSetHandle();
  renderDialog();
  expect(screen.getByRole("dialog", { name: "Pick your passport handle" })).toBeInTheDocument();
  expect(
    screen.getByText("WikiOS signs your edits with it. You can change it once later in Settings.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("3 to 24 lowercase letters, numbers or underscores.")
  ).toBeInTheDocument();
  const input = screen.getByLabelText("Passport handle");
  expect(input).toHaveValue("old_name_2");
  expect(input).toHaveAttribute("maxLength", "25");
});

it("saves the handle, refreshes the passport status, then lets the save go on", async () => {
  const { mutate, options } = mockSetHandle();
  const { onDone, onCancel } = renderDialog();
  fireEvent.change(screen.getByLabelText("Passport handle"), { target: { value: "kir" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(mutate).toHaveBeenCalledWith({ handle: "kir" });
  expect(onDone).not.toHaveBeenCalled();

  // The save goes on only once the passport status has the handle.
  let statusRefreshed = () => undefined as void;
  invalidateStatus.mockReturnValue(new Promise<void>((resolve) => (statusRefreshed = resolve)));
  let success = Promise.resolve();
  act(() => {
    success = options.current!.onSuccess({ handle: "kir" });
  });
  expect(invalidateStatus).toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();

  await act(async () => {
    statusRefreshed();
    await success;
  });
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();
});

it("shows the server's refusal inline and stays open, until the player tries again", () => {
  const { mutate, options } = mockSetHandle();
  const { onDone } = renderDialog();
  const input = screen.getByLabelText("Passport handle");
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  act(() => options.current!.onError({ message: "@old_name_2 is already taken." }));

  expect(screen.getByRole("alert")).toHaveTextContent("@old_name_2 is already taken.");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(onDone).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).toBeNull();

  act(() => options.current!.onError({ message: "That handle is reserved." }));
  fireEvent.change(input, { target: { value: "old_name_9" } });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(input).toHaveAttribute("aria-invalid", "false");
});

it("holds the field and the button while the handle is saving", () => {
  jest
    .mocked(api.ixnayid.setHandle.useMutation)
    .mockReturnValue({ mutate: jest.fn(), isPending: true } as never);
  renderDialog();
  expect(screen.getByLabelText("Passport handle")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
});

it("sends nothing while the field is empty", () => {
  const { mutate } = mockSetHandle();
  renderDialog(null);
  expect(screen.getByLabelText("Passport handle")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(mutate).not.toHaveBeenCalled();
});

it("cancels on Escape", async () => {
  mockSetHandle();
  const { onCancel } = renderDialog();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
});

it("cancels", async () => {
  const { mutate } = mockSetHandle();
  const { onDone, onCancel } = renderDialog();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  expect(mutate).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});
