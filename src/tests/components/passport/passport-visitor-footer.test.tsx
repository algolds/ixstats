/**
 * Signed-out passport visitors see a footer under the document: "Get your own passport" (sign-up) and
 * "Join {primary realm}" by the holder's invite link; signed-in viewers see none of it.
 */
import type { ReactNode } from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { PassportVisitorFooter } from "~/components/passport/PassportVisitorFooter";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const realm = { name: "Eurth", slug: "eurth" };

describe("PassportVisitorFooter", () => {
  it("offers a signed-out visitor a passport and the holder's primary realm by invite", () => {
    render(<PassportVisitorFooter signedOut handle="alex" realm={realm} />);
    expect(screen.getByRole("link", { name: "Get your own passport" })).toHaveAttribute(
      "href",
      "/sign-up"
    );
    expect(screen.getByRole("link", { name: "Join Eurth" })).toHaveAttribute(
      "href",
      "/r/eurth?via=alex"
    );
  });

  it("hides the Join link when the holder has no primary realm", () => {
    render(<PassportVisitorFooter signedOut handle="alex" realm={null} />);
    expect(screen.getByRole("link", { name: "Get your own passport" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /join/i })).not.toBeInTheDocument();
  });

  it("shows nothing to a signed-in viewer", () => {
    const { container } = render(
      <PassportVisitorFooter signedOut={false} handle="alex" realm={realm} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
