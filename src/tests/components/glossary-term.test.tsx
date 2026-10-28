import { fireEvent, render, screen } from "@testing-library/react";

import { GlossaryTerm } from "~/components/maps/core/GlossaryTerm";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

describe("GlossaryTerm", () => {
  it("stays shut when a dialog focuses it on open, and opens on click", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Welcome</DialogTitle>
          <GlossaryTerm label="IxTime">Ixnay&apos;s in-world clock</GlossaryTerm>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByText("Ixnay's in-world clock")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "IxTime" }));
    expect(screen.getByText("Ixnay's in-world clock")).toBeInTheDocument();
  });
});
