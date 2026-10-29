/**
 * The editor's Cancel. With unsaved changes it asks first: Cancel used to close the editor at once and the author's
 * text was gone (no draft, no prompt; the browser's leave-page warning never fires for an in-app close).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { CancelEditButton } from "~/components/wiki-os/editor/components/CancelEditButton";

jest.mock("~/lib/sound/cuelume", () => ({ soundCues: {} }));

describe("CancelEditButton", () => {
  it("with nothing unsaved, cancels at once", () => {
    const onCancel = jest.fn();
    render(<CancelEditButton isDirty={false} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("with unsaved changes, asks; Keep editing leaves the editor open", () => {
    const onCancel = jest.fn();
    render(<CancelEditButton isDirty onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Discard your changes?");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("with unsaved changes, Discard changes cancels", () => {
    const onCancel = jest.fn();
    render(<CancelEditButton isDirty onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
