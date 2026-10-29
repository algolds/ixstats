/**
 * Settings → Privacy & security → Delete account (Privacy 5.2): the request needs the handle typed (or the Clerk
 * username when there is no handle), and a pending request shows its date with "Keep my account".
 */
import { fireEvent, render, screen } from "@testing-library/react";
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/context/auth-context", () => ({ useUser: jest.fn() }));
jest.mock("~/trpc/react", () => {
  const request = { mutate: jest.fn(), isPending: false };
  const cancel = { mutate: jest.fn(), isPending: false };
  return {
    api: {
      useUtils: () => ({ users: { getAccountDeletion: { invalidate: jest.fn() } } }),
      users: {
        getAccountDeletion: { useQuery: jest.fn() },
        getProfile: { useQuery: jest.fn() },
        requestAccountDeletion: { useMutation: () => request },
        cancelAccountDeletion: { useMutation: () => cancel },
      },
    },
  };
});
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { DeleteAccountRow } from "~/app/settings/_components/panels/DeleteAccountRow";

function setup({
  requestedAt = null as Date | null,
  erasesAt = null as Date | null,
  handle = "alex" as string | null,
  username = "alexclerk" as string | null,
} = {}) {
  jest
    .mocked(api.users.getAccountDeletion.useQuery)
    .mockReturnValue({ data: { requestedAt, erasesAt } } as never);
  jest.mocked(api.users.getProfile.useQuery).mockReturnValue({ data: { handle } } as never);
  jest.mocked(useUser).mockReturnValue({
    user: { username, primaryEmailAddress: { emailAddress: "a@example.com" } },
  } as never);
  render(<DeleteAccountRow glyphClass="" />);
}

const requestMutation = () => api.users.requestAccountDeletion.useMutation();
const cancelMutation = () => api.users.cancelAccountDeletion.useMutation();

beforeEach(() => jest.clearAllMocks());

describe("DeleteAccountRow", () => {
  it("asks for the handle before it requests the deletion", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText(/credited to “a former member”/)).toBeInTheDocument();
    const confirm = screen.getByLabelText("Type alex to confirm");
    const submit = screen.getAllByRole("button", { name: "Delete account" }).at(-1)!;
    expect(submit).toBeDisabled();

    fireEvent.change(confirm, { target: { value: "someone" } });
    expect(submit).toBeDisabled();
    fireEvent.change(confirm, { target: { value: " Alex " } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(requestMutation().mutate).toHaveBeenCalledWith({ confirmHandle: "Alex" });
  });

  it("asks for the Clerk username when there is no handle", () => {
    setup({ handle: null });
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByLabelText("Type alexclerk to confirm")).toBeInTheDocument();
  });

  it("shows the deletion date and keeps the account on request", () => {
    setup({
      requestedAt: new Date("2026-10-28T12:00:00Z"),
      erasesAt: new Date("2026-11-11T12:00:00Z"),
    });
    expect(screen.getByText(/^Your account will be deleted on .*2026\.$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keep my account" }));
    expect(cancelMutation().mutate).toHaveBeenCalled();
  });
});
