import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/exchange/ExchangeSection", () => ({
  ExchangeSection: () => <div data-testid="exchange" />,
}));

import LabsExchangePage from "~/app/labs/exchange/page";

describe("/labs/exchange", () => {
  it("renders the Exchange inside the page container and gutter", () => {
    render(<LabsExchangePage />);
    const container = screen.getByTestId("exchange").parentElement;
    expect(container).toHaveClass("container", "mx-auto", "px-4");
  });
});
