/**
 * The one wiki picker: Wiki, IIWiki, AltHistory Wiki, Wiki selected by default. A wiki that cannot answer (the IIWiki
 * switch, its breaker) is listed but disabled, the reason is said under the control, and it is never left selected,
 * even when it goes off after it was picked.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { IiwikiAvailability } from "~/lib/wiki-os/wiki-source-availability";

let mockAvailability: Partial<IiwikiAvailability> | undefined;
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      iiwikiAvailability: { useQuery: () => ({ data: mockAvailability }) },
    },
  },
}));

import { WikiSourcePicker, useWikiSource } from "~/components/wiki-os/shared/WikiSourcePicker";

function Harness() {
  const { source, setSource, options } = useWikiSource("imports");
  return (
    <>
      <WikiSourcePicker value={source} onValueChange={setSource} options={options} />
      <output data-testid="source">{source}</output>
    </>
  );
}

const radio = (name: string) => screen.getByRole("radio", { name });

beforeEach(() => {
  mockAvailability = undefined;
});

describe("WikiSourcePicker", () => {
  it("lists Wiki first and selects it by default", () => {
    render(<Harness />);
    const names = screen.getAllByRole("radio").map((r) => r.textContent);
    expect(names[0]).toBe("Wiki");
    expect(names).toEqual(expect.arrayContaining(["IIWiki", "AltHistory Wiki"]));
    expect(screen.getByTestId("source")).toHaveTextContent("ixwiki");
    expect(radio("Wiki")).toHaveAttribute("aria-checked", "true");
  });

  it("lets a sister wiki be picked while it answers", () => {
    mockAvailability = { imports: null };
    render(<Harness />);
    fireEvent.click(radio("IIWiki"));
    expect(screen.getByTestId("source")).toHaveTextContent("iiwiki");
  });

  it("disables IIWiki with a plain reason when it is switched off", () => {
    mockAvailability = { imports: "disabled" };
    render(<Harness />);
    expect(radio("IIWiki")).toBeDisabled();
    expect(radio("AltHistory Wiki")).not.toBeDisabled();
    expect(screen.getByText("IIWiki is switched off for now.")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Wiki" })).toHaveAccessibleDescription(
      "IIWiki is switched off for now."
    );
  });

  it("moves off IIWiki when it goes off after being picked", () => {
    mockAvailability = { imports: null };
    const { rerender } = render(<Harness />);
    fireEvent.click(radio("IIWiki"));
    expect(screen.getByTestId("source")).toHaveTextContent("iiwiki");

    mockAvailability = { imports: "resting" };
    rerender(<Harness />);
    expect(screen.getByTestId("source")).toHaveTextContent("ixwiki");
    expect(screen.getByText("IIWiki could not be reached just now.")).toBeInTheDocument();
  });
});
