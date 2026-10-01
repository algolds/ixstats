import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuilderRealmPicker } from "~/app/builder/components/BuilderRealmPicker";

// Radix Select doesn't render its options in jsdom; swap in a native <select>.
jest.mock("~/components/ui/select", () => {
  const SelectCtx = React.createContext<{
    value?: string;
    onValueChange?: (v: string) => void;
  }>({});
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (v: string) => void;
      children: React.ReactNode;
    }) => <SelectCtx.Provider value={{ value, onValueChange }}>{children}</SelectCtx.Provider>,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange } = React.useContext(SelectCtx);
      return (
        <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({
      value,
      disabled,
      children,
    }: {
      value: string;
      disabled?: boolean;
      children: React.ReactNode;
    }) => (
      <option value={value} disabled={disabled}>
        {children}
      </option>
    ),
  };
});

let mockData: unknown;
jest.mock("~/trpc/react", () => ({
  api: { realms: { builderRealms: { useQuery: () => ({ data: mockData }) } } },
}));

const ixworld = {
  id: "default",
  slug: "ixworld",
  name: "IxWorld",
  held: 1,
  cap: 1,
  canCreate: false,
};
const eurth = { id: "eurth", slug: "eurth", name: "Eurth", held: 0, cap: 1, canCreate: true };

describe("BuilderRealmPicker", () => {
  it("renders nothing while loading or when the one open realm has room", () => {
    mockData = undefined;
    const { container, rerender } = render(
      <BuilderRealmPicker value={null} onChange={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    mockData = { defaultRealmId: "default", realms: [{ ...ixworld, held: 0, canCreate: true }] };
    rerender(<BuilderRealmPicker value={null} onChange={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("with one realm, says so when the player is at the cap there", () => {
    mockData = { defaultRealmId: "default", realms: [ixworld] };
    render(<BuilderRealmPicker value={null} onChange={jest.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "You hold 1 of 1 nation allowed in IxWorld."
    );
  });

  it("with several realms, picks among them; full realms are disabled", () => {
    mockData = { defaultRealmId: "default", realms: [ixworld, eurth] };
    const onChange = jest.fn();
    render(<BuilderRealmPicker value={null} onChange={onChange} />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("default");
    expect(screen.getByRole("option", { name: "IxWorld (1/1)" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Eurth (0/1)" })).toBeEnabled();
    // The default realm is full, so the player is told why they must choose another.
    expect(screen.getByRole("status")).toHaveTextContent("IxWorld");

    fireEvent.change(select, { target: { value: "eurth" } });
    expect(onChange).toHaveBeenCalledWith("eurth");
  });

  it("shows the chosen realm and no cap notice when it has room", () => {
    mockData = { defaultRealmId: "default", realms: [ixworld, eurth] };
    render(<BuilderRealmPicker value="eurth" onChange={jest.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("eurth");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
