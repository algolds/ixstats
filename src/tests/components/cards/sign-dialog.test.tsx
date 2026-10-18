/**
 * Signing a copy once: the dialog cleans and counts the text with the server's own rule, previews it with the exact
 * name that will be frozen beside it, and refuses a player with no name other players can read.
 */
import React from "react";
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

  it("names the viewer as other players will read them, the name frozen with the inscription", () => {
    setup("Caphiria");
    expect(
      screen.getByText(
        /Your name as other players see it, Caphiria, is saved with it and stays with the copy wherever it goes\./
      )
    ).toBeTruthy();
  });

  it("starts empty, counting nothing and offering no signature yet", () => {
    const { mutate } = setup();
    expect(screen.getByText("0 of 60")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign this copy" }).hasAttribute("disabled")).toBe(
      true
    );
    fireEvent.submit(screen.getByLabelText("Inscription").closest("form")!);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("ties the count and the reason to the field, announced as they change", () => {
    setup();
    const field = screen.getByLabelText("Inscription");
    const status = document.getElementById(field.getAttribute("aria-describedby") ?? "");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    fireEvent.change(field, { target: { value: "see www.example.com" } });
    expect(status?.textContent).toBe("Links aren't allowed.");
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });

  it("shows how to get a name instead of a sign button for a player with none", () => {
    const { mutate } = setup(null);
    expect(
      screen.getByText("Claim an IxnayID handle or a nation before signing a card.")
    ).toBeTruthy();
    expect(screen.queryByLabelText("Inscription")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign this copy" })).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });
});
