import { render } from "@testing-library/react";
import { Tooltip } from "~/components/ui/tooltip";

// Radix only warns under the "development" export condition, which Jest does not set.
jest.mock("@radix-ui/primitive/is-development", () => ({ IS_DEVELOPMENT: true }));

test("toggling `disabled` never switches the tooltip between controlled and uncontrolled", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const ui = (disabled: boolean) => (
    <Tooltip content="Label" disabled={disabled}>
      <button type="button">Trigger</button>
    </Tooltip>
  );
  const { rerender } = render(ui(false));
  rerender(ui(true));
  rerender(ui(false));
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
