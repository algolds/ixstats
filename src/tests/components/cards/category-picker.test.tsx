/** The shared category picker: a category, then one of its fixed subcategories. */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CategoryChoice } from "~/lib/cards/category-taxonomy";
import { CategoryPicker } from "~/components/cards/category/CategoryPicker";
import { CategoryChoiceDialog } from "~/components/cards/category/CategoryChoiceDialog";

jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

const ARMY: CategoryChoice = { category: "MILITARY", subcategory: "army" };

function setup(value: CategoryChoice = ARMY, allowUncategorised = true) {
  const onChange = jest.fn();
  render(
    <CategoryPicker
      idPrefix="t"
      value={value}
      onChange={onChange}
      allowUncategorised={allowUncategorised}
    />
  );
  return onChange;
}

describe("CategoryPicker", () => {
  it("resets the subcategory when the category changes", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "HISTORY" } });
    expect(onChange).toHaveBeenCalledWith({ category: "HISTORY", subcategory: null });
  });

  it("offers only the category's own subcategories, after No subcategory", () => {
    const onChange = setup();
    expect(screen.getByRole("option", { name: "Battle or war" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Event" })).toBeNull();
    const subOptions = Array.from(
      (screen.getByLabelText("Subcategory") as HTMLSelectElement).options
    ).map((o) => o.text);
    expect(subOptions[0]).toBe("No subcategory");
    fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "__none" } });
    expect(onChange).toHaveBeenCalledWith({ category: "MILITARY", subcategory: null });
    fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "navy" } });
    expect(onChange).toHaveBeenCalledWith({ category: "MILITARY", subcategory: "navy" });
  });

  it("hides the subcategory for Special, and Uncategorised where it is not allowed", () => {
    setup({ category: "SPECIAL", subcategory: null }, false);
    expect(screen.queryByLabelText("Subcategory")).toBeNull();
    expect(screen.queryByRole("option", { name: "Uncategorised" })).toBeNull();
  });

  it("lists Uncategorised first where allowed, and picking it clears both", () => {
    const onChange = setup();
    const categories = Array.from(
      (screen.getByLabelText("Category") as HTMLSelectElement).options
    ).map((o) => o.text);
    expect(categories).toHaveLength(13);
    expect(categories[0]).toBe("Uncategorised");
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "__none" } });
    expect(onChange).toHaveBeenCalledWith({ category: null, subcategory: null });
  });

  it("shows an uncategorised card as Uncategorised, with no subcategory", () => {
    setup({ category: null, subcategory: null });
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("__none");
    expect(screen.queryByLabelText("Subcategory")).toBeNull();
  });
});

describe("CategoryChoiceDialog", () => {
  function dialog(over: Partial<Parameters<typeof CategoryChoiceDialog>[0]> = {}) {
    const onConfirm = jest.fn();
    const props = {
      open: true,
      onOpenChange: jest.fn(),
      title: "Set the category",
      initial: ARMY,
      confirmLabel: "Save",
      pending: false,
      onConfirm,
      ...over,
    };
    const view = render(<CategoryChoiceDialog {...props} />);
    return { onConfirm, props, view };
  }

  it("confirms the picked choice with the note trimmed, or null when empty", () => {
    const { onConfirm } = dialog({ withNote: true });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "HISTORY" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "  Its own article  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onConfirm).toHaveBeenLastCalledWith(
      { category: "HISTORY", subcategory: null },
      "Its own article"
    );
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onConfirm).toHaveBeenLastCalledWith({ category: "HISTORY", subcategory: null }, null);
  });

  it("has no note field unless asked, and shows the notice above the picker", () => {
    dialog({ notice: <p>Already suggested</p> });
    expect(screen.queryByLabelText("Note")).toBeNull();
    expect(screen.getByText("Already suggested")).toBeInTheDocument();
  });

  it("disables the button while pending, or with no category where Uncategorised is not allowed", () => {
    const { view, props } = dialog({ pending: true });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    // The draft resets to `initial` only when the dialog opens, so close and reopen it
    const uncategorised = {
      ...props,
      pending: false,
      allowUncategorised: false,
      initial: { category: null, subcategory: null },
    };
    view.rerender(<CategoryChoiceDialog {...uncategorised} open={false} />);
    view.rerender(<CategoryChoiceDialog {...uncategorised} open />);
    expect(screen.getByLabelText("Category")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("resets the draft to the initial choice each time it opens", () => {
    const { view, props } = dialog();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "HISTORY" } });
    view.rerender(<CategoryChoiceDialog {...props} open={false} />);
    view.rerender(<CategoryChoiceDialog {...props} open />);
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("MILITARY");
    expect((screen.getByLabelText("Subcategory") as HTMLSelectElement).value).toBe("army");
  });

  it("gives focus back to the control that opened it when it has no trigger of its own", async () => {
    function Opener() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit
          </button>
          <CategoryChoiceDialog
            open={open}
            onOpenChange={setOpen}
            title="Set the category"
            initial={ARMY}
            confirmLabel="Save"
            pending={false}
            onConfirm={jest.fn()}
          />
        </>
      );
    }
    render(<Opener />);
    const edit = screen.getByRole("button", { name: "Edit" });
    edit.focus();
    fireEvent.click(edit);
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(edit).toHaveFocus());
  });
});
