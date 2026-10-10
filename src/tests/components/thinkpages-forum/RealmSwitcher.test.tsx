import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router };
});

interface SelectStubProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

// Radix Select does not render its options in jsdom; swap in a native <select>.
jest.mock("~/components/ui/select", () => {
  const { createContext, useContext } = jest.requireActual<typeof React>("react");
  const Ctx = createContext<Omit<SelectStubProps, "children">>({});
  return {
    Select: ({ value, onValueChange, children }: SelectStubProps) => (
      <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>
    ),
    SelectTrigger: ({ "aria-label": label }: { "aria-label"?: string }) => (
      <span data-testid="trigger" aria-label={label} />
    ),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange } = useContext(Ctx);
      return (
        <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

import { RealmSwitcher } from "~/components/thinkpages-forum/RealmSwitcher";

const { router } = jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock } }>(
  "next/navigation"
);

const realms = [
  { slug: "ixworld", name: "IxWorld" },
  { slug: "eurth", name: "Eurth" },
  { slug: "other", name: "Other" },
];

describe("RealmSwitcher", () => {
  it("offers the given realms with the open one selected", () => {
    render(<RealmSwitcher realms={realms} value="eurth" />);
    expect(screen.getByLabelText("Realm")).toBeInTheDocument();
    const select = screen.getByRole("combobox");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["IxWorld", "Eurth", "Other"]);
    expect(select).toHaveValue("eurth");
  });

  it("opens the chosen realm's Hub board", () => {
    render(<RealmSwitcher realms={realms} value="eurth" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "other" } });
    expect(router.push).toHaveBeenCalledWith("/thinkpages/r/other/hub");
  });

  it("opens the page the caller names", () => {
    router.push.mockClear();
    render(
      <RealmSwitcher realms={realms} value="eurth" hrefFor={(slug) => `/thinkpages/r/${slug}`} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "other" } });
    expect(router.push).toHaveBeenCalledWith("/thinkpages/r/other");
  });
});
