import { render, screen, fireEvent } from "@testing-library/react";
import { RepealPolicyButton } from "~/components/executive/politics/RepealPolicyButton";

const mockRepealMutate = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    policies: {
      repealPolicy: {
        useMutation: () => ({ mutate: mockRepealMutate, isPending: false }),
      },
    },
    useUtils: () => ({
      policies: { getPolicyReconContext: { invalidate: jest.fn() } },
    }),
  },
}));

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

describe("RepealPolicyButton", () => {
  beforeEach(() => mockRepealMutate.mockClear());

  it("repeals only after the confirmation", () => {
    render(<RepealPolicyButton policyId="pol_1" policyName="Universal Stipend" />);

    fireEvent.click(screen.getByRole("button", { name: "Repeal" }));
    expect(mockRepealMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Repeal this law?")).toBeInTheDocument();

    const confirm = screen.getAllByRole("button", { name: "Repeal" }).at(-1)!;
    fireEvent.click(confirm);
    expect(mockRepealMutate).toHaveBeenCalledWith({ policyId: "pol_1" });
  });

  it("does nothing when the confirmation is cancelled", () => {
    render(<RepealPolicyButton policyId="pol_1" policyName="Universal Stipend" />);

    fireEvent.click(screen.getByRole("button", { name: "Repeal" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(mockRepealMutate).not.toHaveBeenCalled();
  });
});
