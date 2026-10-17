import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReasonDialog } from "~/app/admin/cards/shared/ReasonDialog";

describe("ReasonDialog", () => {
  it("asks for a reason of at least 3 characters and passes it on trimmed", () => {
    const onConfirm = jest.fn();
    render(
      <ReasonDialog
        open
        onOpenChange={() => undefined}
        title="Revoke this copy"
        description="It leaves the player's collection."
        confirmLabel="Revoke"
        destructive
        onConfirm={onConfirm}
      />
    );
    const confirm = screen.getByRole("button", { name: "Revoke" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  duplicate grant  " } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("duplicate grant");
  });

  it("stays disabled while pending, and clears the reason when cancelled", () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <ReasonDialog
        open
        onOpenChange={onOpenChange}
        title="Void this trade"
        description="Both sides get their cards back."
        confirmLabel="Void"
        pending
        onConfirm={jest.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "fraud" } });
    expect(screen.getByRole("button", { name: "Void" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(
      <ReasonDialog
        open
        onOpenChange={onOpenChange}
        title="Void this trade"
        description="Both sides get their cards back."
        confirmLabel="Void"
        onConfirm={jest.fn()}
      />
    );
    expect(screen.getByLabelText("Reason")).toHaveValue("");
  });
});
