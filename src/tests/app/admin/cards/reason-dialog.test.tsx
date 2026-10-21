import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("stays disabled while pending, and asks the parent to close on Cancel", () => {
    const onOpenChange = jest.fn();
    render(<VoidDialog open pending onOpenChange={onOpenChange} onConfirm={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "fraud" } });
    expect(screen.getByRole("button", { name: "Void" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens empty again after a confirmed action closes it", () => {
    const onConfirm = jest.fn();
    const { rerender } = render(
      <VoidDialog open onOpenChange={() => undefined} onConfirm={onConfirm} />
    );
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "fraud ring" } });
    fireEvent.click(screen.getByRole("button", { name: "Void" }));
    expect(onConfirm).toHaveBeenCalledWith("fraud ring");

    rerender(<VoidDialog open={false} onOpenChange={() => undefined} onConfirm={onConfirm} />);
    rerender(<VoidDialog open onOpenChange={() => undefined} onConfirm={onConfirm} />);
    expect(screen.getByLabelText("Reason")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Void" })).toBeDisabled();
  });

  it("gives focus back to the button that opened it, cancelled or confirmed", async () => {
    render(<OpenedFromRow />);
    const opener = screen.getByRole("button", { name: "Void trade with Elmland" });
    for (const close of ["Cancel", "Void"]) {
      opener.focus();
      fireEvent.click(opener);
      expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
      fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "fraud ring" } });
      fireEvent.click(screen.getByRole("button", { name: close }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(opener).toHaveFocus();
    }
  });
});

/** A row's button opening the dialog, which has no trigger of its own, as the admin tools use it. */
function OpenedFromRow() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Void trade with Elmland</button>
      <VoidDialog open={open} onOpenChange={setOpen} onConfirm={() => setOpen(false)} />
    </>
  );
}

/** The dialog as a trade void would open it. */
function VoidDialog(props: {
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  return (
    <ReasonDialog
      {...props}
      title="Void this trade"
      description="Both sides get their cards back."
      confirmLabel="Void"
    />
  );
}
