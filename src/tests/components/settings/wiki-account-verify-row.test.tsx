import { act, render, screen, fireEvent } from "@testing-library/react";
import { WikiAccountVerifyRow } from "~/components/settings/WikiAccountVerifyRow";

const mockStartMutate = jest.fn();
const mockConfirmMutate = jest.fn();
const mockUnlinkMutate = jest.fn();
const mockListWikiLinksInvalidate = jest.fn();
const mockGetStatusInvalidate = jest.fn();

let startOnSuccess: ((res: unknown) => void) | undefined;
let unlinkOnSuccess: (() => void) | undefined;

jest.mock("~/trpc/react", () => ({
  api: {
    ixnayid: {
      startWikiVerification: {
        useMutation: (opts?: { onSuccess?: (res: unknown) => void }) => {
          startOnSuccess = opts?.onSuccess;
          return { mutate: mockStartMutate, isPending: false };
        },
      },
      confirmWikiVerification: {
        useMutation: () => ({ mutate: mockConfirmMutate, isPending: false }),
      },
      unlinkWikiAccount: {
        useMutation: (opts?: { onSuccess?: () => void }) => {
          unlinkOnSuccess = opts?.onSuccess;
          return { mutate: mockUnlinkMutate, isPending: false };
        },
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
    mockStartMutate.mockReset();
    startOnSuccess = undefined;
    unlinkOnSuccess = undefined;
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

  it("a pending link can be unlinked (ruling F-4) — no dead end", () => {
    render(
      <WikiAccountVerifyRow
        source="iiwiki"
        label="IIWiki"
        link={{ source: "iiwiki", username: "Kir", verified: false, pending: true }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /unlink/i }));
    expect(mockUnlinkMutate).toHaveBeenCalledWith({ source: "iiwiki" });
  });

  it("a code fetched this session can be abandoned with Unlink, which clears the code on success", () => {
    mockStartMutate.mockImplementation(() => {
      startOnSuccess?.({
        token: "ABC123",
        username: "Kir",
        expiresAt: "2026-01-01T00:00:00Z",
        userPageUrl: "https://iiwiki.com/wiki/User:Kir",
      });
    });
    render(<WikiAccountVerifyRow source="iiwiki" label="IIWiki" link={undefined} />);
    fireEvent.change(screen.getByPlaceholderText(/iiwiki username/i), { target: { value: "Kir" } });
    fireEvent.click(screen.getByRole("button", { name: /get code/i }));
    expect(screen.getByText("ABC123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /unlink/i }));
    expect(mockUnlinkMutate).toHaveBeenCalledWith({ source: "iiwiki" });
    act(() => unlinkOnSuccess?.());
    expect(screen.queryByText("ABC123")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get code/i })).toBeInTheDocument();
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

  it("shows the verified account's username in the instructions on first-time Get code, before link refetches", () => {
    mockStartMutate.mockImplementation(() => {
      startOnSuccess?.({
        token: "ABC123",
        username: "Kir",
        expiresAt: "2026-01-01T00:00:00Z",
        userPageUrl: "https://iiwiki.com/wiki/User:Kir",
      });
    });

    render(<WikiAccountVerifyRow source="iiwiki" label="IIWiki" link={undefined} />);

    fireEvent.change(screen.getByPlaceholderText(/iiwiki username/i), {
      target: { value: "Kir" },
    });
    fireEvent.click(screen.getByRole("button", { name: /get code/i }));

    // link is still undefined here (listWikiLinks hasn't refetched yet) — the username must
    // come from the mutation's own response, not from `link`.
    expect(screen.getByText(/Kir/)).toBeInTheDocument();
  });
});
