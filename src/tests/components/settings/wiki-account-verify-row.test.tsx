import { render, screen } from "@testing-library/react";
import { WikiAccountVerifyRow } from "~/components/settings/WikiAccountVerifyRow";

const mockStartMutate = jest.fn();
const mockConfirmMutate = jest.fn();
const mockUnlinkMutate = jest.fn();
const mockListWikiLinksInvalidate = jest.fn();
const mockGetStatusInvalidate = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    ixnayid: {
      startWikiVerification: {
        useMutation: () => ({ mutate: mockStartMutate, isPending: false }),
      },
      confirmWikiVerification: {
        useMutation: () => ({ mutate: mockConfirmMutate, isPending: false }),
      },
      unlinkWikiAccount: {
        useMutation: () => ({ mutate: mockUnlinkMutate, isPending: false }),
      },
    },
    useUtils: () => ({
      ixnayid: {
        listWikiLinks: { invalidate: mockListWikiLinksInvalidate },
        getStatus: { invalidate: mockGetStatusInvalidate },
      },
    }),
  },
}));

describe("WikiAccountVerifyRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("offers to get a code when nothing is linked", () => {
    render(<WikiAccountVerifyRow source="iiwiki" label="IIWiki" link={undefined} />);
    expect(screen.getByPlaceholderText(/iiwiki username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get code/i })).toBeInTheDocument();
  });

  it("offers Verify while a code is pending", () => {
    render(
      <WikiAccountVerifyRow
        source="iiwiki"
        label="IIWiki"
        link={{ source: "iiwiki", username: "Kir", verified: false, pending: true }}
      />
    );
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
  });

  it("shows Verified and Unlink once verified", () => {
    render(
      <WikiAccountVerifyRow
        source="iiwiki"
        label="IIWiki"
        link={{ source: "iiwiki", username: "Kir", verified: true, pending: false }}
      />
    );
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlink/i })).toBeInTheDocument();
  });
});
