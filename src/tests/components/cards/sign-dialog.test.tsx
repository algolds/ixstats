/**
 * Signing a copy once: the dialog cleans and counts the text with the server's own rule, previews it with the exact
 * name that will be frozen beside it, and refuses a player with no name other players can read.
 */
import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));

import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { SignDialog } from "~/components/cards/sheet/economy/SignDialog";

function setup(signerName: string | null = "@ixnay") {
  const mutate = jest.fn();
  const onDone = jest.fn();
  jest.mocked(useCopyActions).mockReturnValue({ sign: { mutate, isPending: false } } as never);
  render(
    <SignDialog
      open
      onOpenChange={jest.fn()}
      onDone={onDone}
      cardTitle="Aurelia"
      ownershipId="a"
      signerName={signerName}
    />
  );
  return { mutate, onDone };
}

describe("SignDialog", () => {
  it("previews the sanitised text, counts characters and refuses markup", () => {
    const { mutate, onDone } = setup();
    const field = screen.getByLabelText("Inscription");
    fireEvent.change(field, { target: { value: "<b>hi</b>" } });
    expect(screen.getByText("HTML tags aren't allowed.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign this copy" }).hasAttribute("disabled")).toBe(
      true
    );
    fireEvent.change(field, { target: { value: "  first   pull " } });
    expect(screen.getByText("10 of 60")).toBeTruthy();
    expect(screen.getByText("“first pull” · @ixnay")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign this copy" }));
    expect(mutate).toHaveBeenCalledWith(
      { ownershipId: "a", text: "first pull" },
      expect.anything()
    );
    mutate.mock.calls[0]![1].onSuccess();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
