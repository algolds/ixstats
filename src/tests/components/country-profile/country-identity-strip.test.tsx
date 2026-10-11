/** The realm and IxnayID pills (MyCountry, country profiles): details hidden at rest, each pill opening on its own hover or focus. */

import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CountryIdentityStrip } from "~/components/country-profile/CountryIdentityStrip";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/components/realms/ClaimNationButton", () => ({ ClaimNationButton: () => null }));

// jsdom has no PointerEvent, so fireEvent would drop `pointerType`.
class TestPointerEvent extends MouseEvent {
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? "";
  }
}
window.PointerEvent ??= TestPointerEvent as unknown as typeof PointerEvent;

// A closed detail is zero-width (still read by screen readers); its state says whether it is open.
const isVisuallyHidden = (text: string) =>
  screen.getByText(text).closest("[data-state]")?.getAttribute("data-state") === "closed";

function renderCompact() {
  render(
    <CountryIdentityStrip
      realm={{ name: "Ixnay", slug: "ixnay" }}
      sovereign={{ username: "kir", roleName: "Sovereign" }}
    />
  );
  return {
    realmPill: screen.getByRole("link", { name: /Ixnay/ }),
    handlePill: screen.getByRole("link", { name: /@kir/ }),
  };
}

describe("CountryIdentityStrip pills", () => {
  it("keeps the realm and handle as links, with the details hidden from sight but not from screen readers", () => {
    const { realmPill, handlePill } = renderCompact();
    expect(realmPill).toHaveAttribute("href", "/r/ixnay");
    expect(handlePill).toHaveAttribute("href", "/@kir");
    expect(isVisuallyHidden("Primary realm")).toBe(true);
    expect(isVisuallyHidden("Sovereign")).toBe(true);
  });

  it("morphs each pill on its own: hovering the realm opens only the realm", () => {
    const { realmPill, handlePill } = renderCompact();
    fireEvent.pointerOver(realmPill, { pointerType: "mouse" });
    expect(isVisuallyHidden("Primary realm")).toBe(false);
    expect(isVisuallyHidden("Sovereign")).toBe(true);
    fireEvent.pointerOut(realmPill, { pointerType: "mouse" });
    expect(isVisuallyHidden("Primary realm")).toBe(true);

    fireEvent.pointerOver(handlePill, { pointerType: "mouse" });
    expect(isVisuallyHidden("Sovereign")).toBe(false);
    expect(isVisuallyHidden("Primary realm")).toBe(true);
  });

  it("does not open for a touch, which just follows the link", () => {
    const { realmPill } = renderCompact();
    fireEvent.pointerOver(realmPill, { pointerType: "touch" });
    expect(isVisuallyHidden("Primary realm")).toBe(true);
  });

  it("opens a pill while it has keyboard focus", () => {
    const { realmPill } = renderCompact();
    fireEvent.focus(realmPill);
    expect(isVisuallyHidden("Primary realm")).toBe(false);
    fireEvent.blur(realmPill);
    expect(isVisuallyHidden("Primary realm")).toBe(true);
  });

  it("shows the Clerk profile picture, the realm's logo and a border for the sovereign's role", () => {
    render(
      <CountryIdentityStrip
        realm={{ name: "Eurth", slug: "eurth", logoUrl: "https://img.example/eurth.png" }}
        sovereign={{
          username: "kir",
          roleName: "Administrator",
          avatarUrl: "https://img.clerk.example/kir.png",
          role: "admin",
        }}
      />
    );
    const realmPill = screen.getByRole("link", { name: /Eurth/ });
    const handlePill = screen.getByRole("link", { name: /@kir/ });
    expect(realmPill.querySelector("img")).toHaveAttribute("src", "https://img.example/eurth.png");
    expect(handlePill.querySelector("img")).toHaveAttribute("src", "https://img.clerk.example/kir.png");
    expect(handlePill).toHaveAttribute("data-role", "admin");
    expect(handlePill.className).toContain("border-red");
  });

  it("falls back to icons without pictures, and draws no role border for a standard user", () => {
    render(
      <CountryIdentityStrip
        realm={{ name: "Eurth", slug: "eurth" }}
        sovereign={{ username: "kir", role: "user" }}
      />
    );
    expect(screen.getByRole("link", { name: /Eurth/ }).querySelector("img")).toBeNull();
    const handlePill = screen.getByRole("link", { name: /@kir/ });
    expect(handlePill.querySelector("img")).toBeNull();
    expect(handlePill.className).toContain("border-transparent");
  });
});
