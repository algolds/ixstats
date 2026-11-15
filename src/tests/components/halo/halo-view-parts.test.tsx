import { fireEvent, render, screen } from "@testing-library/react";
import { Bell, Crown } from "iconoir-react";
import {
  HaloCloseButton,
  HaloEmpty,
  HaloViewHeader,
} from "~/components/halo/views/shared/HaloViewParts";
import { Button } from "~/components/ui/button";

describe("HaloViewParts", () => {
  it("renders HaloViewHeader with title, leading/trailing slots, and Close button calling onClose", () => {
    const onClose = jest.fn();
    render(
      <HaloViewHeader
        title="Notifications"
        titleId="halo-test-title"
        leading={<Crown data-testid="leading-icon" />}
        trailing={<Button type="button">Read all</Button>}
        onClose={onClose}
      />
    );

    const heading = screen.getByRole("heading", { name: "Notifications" });
    expect(heading).toHaveAttribute("id", "halo-test-title");
    expect(screen.getByTestId("leading-icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read all" })).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders HaloCloseButton calling onClose", () => {
    const onClose = jest.fn();
    render(<HaloCloseButton onClick={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders HaloEmpty with icon, title, message, and action", () => {
    const onAction = jest.fn();
    render(
      <HaloEmpty
        icon={<Bell data-testid="empty-icon" />}
        title="No notifications"
        message="You are all caught up."
        action={
          <Button type="button" onClick={onAction}>
            Refresh
          </Button>
        }
      />
    );

    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
    expect(screen.getByText("No notifications")).toBeInTheDocument();
    expect(screen.getByText("You are all caught up.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
