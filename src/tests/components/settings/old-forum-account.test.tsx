/**
 * Phase 4b (Q11): forum account linking is retired. Settings show the old forum account read-only: the name the
 * import attributes posts to, or that there is none. No connect, verify or unlink control is offered.
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { OldForumAccount, oldForumAccountText } from "~/components/settings/OldForumAccount";

describe("oldForumAccountText", () => {
  it("names the imported account, or says there is none", () => {
    expect(oldForumAccountText({ linked: true, username: "Kir" })).toBe("Imported as Kir");
    expect(oldForumAccountText({ linked: false, username: null })).toBe("No old-forum account");
    expect(oldForumAccountText({ linked: true, username: null })).toBe("Imported");
  });
});

describe("OldForumAccount", () => {
  it("is read-only: text only, no button or link", () => {
    render(<OldForumAccount forum={{ linked: true, username: "Kir" }} />);
    expect(screen.getByText("Imported as Kir")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says linking is a staff action when there is no account", () => {
    render(<OldForumAccount forum={{ linked: false, username: null }} />);
    expect(screen.getByText("No old-forum account")).toBeInTheDocument();
    expect(screen.getByText(/staff/i)).toBeInTheDocument();
  });
});
