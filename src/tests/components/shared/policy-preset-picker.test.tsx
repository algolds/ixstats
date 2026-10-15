/**
 * The policy preset picker applies a preset's whole set in one call, and asks first when that
 * would replace institutions the player chose.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { PolicyPresetPicker } from "~/components/shared/government/PolicyPresetPicker";
import { getPolicyPreset } from "~/lib/government/policy-presets";

const name = (type: string) => type.toLowerCase().replace(/_/g, " ");
const technocracy = getPolicyPreset("technocracy")!;

function renderPicker(currentChoices: string[]) {
  const onApply = jest.fn();
  render(
    <PolicyPresetPicker
      idPrefix="test"
      currentChoices={currentChoices}
      onApply={onApply}
      componentName={name}
    />
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Policy presets" }), {
    target: { value: "technocracy" },
  });
  return onApply;
}

describe("PolicyPresetPicker", () => {
  it("lists all 55 presets and needs one chosen before applying", () => {
    render(
      <PolicyPresetPicker
        idPrefix="t"
        currentChoices={[]}
        onApply={jest.fn()}
        componentName={name}
      />
    );
    expect(screen.getByRole("heading", { name: "Policy presets" })).toBeInTheDocument();
    // 55 presets plus the placeholder.
    expect(screen.getAllByRole("option")).toHaveLength(56);
    expect(screen.getByRole("button", { name: "Use preset" })).toBeDisabled();
  });

  it("applies the whole set at once when nothing would be replaced", () => {
    const onApply = renderPicker([]);
    expect(screen.getByText(/^Expert-driven governance/)).toHaveTextContent(
      `Sets ${technocracy.components.length} institutions`
    );
    fireEvent.click(screen.getByRole("button", { name: "Use preset" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(technocracy.components, "technocracy");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks before replacing the player's choices, and keeps them on Keep mine", () => {
    const onApply = renderPicker(["DEMOCRATIC_PROCESS", "RULE_OF_LAW"]);
    fireEvent.click(screen.getByRole("button", { name: "Use preset" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Replace your institutions?");
    expect(dialog).toHaveTextContent(
      `Technocracy replaces the 2 institutions you chose with its own ${technocracy.components.length}.`
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Use preset" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(technocracy.components, "technocracy");
  });
});
