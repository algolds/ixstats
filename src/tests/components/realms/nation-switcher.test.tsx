import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NationSwitcher } from "~/components/navigation/NationSwitcher";

interface MutationOptions {
  onSuccess?: () => Promise<void> | void;
  onError?: (error: { message: string }) => void;
}

let mockData: unknown;
let mutationOptions: MutationOptions = {};
const mockMutate = jest.fn();
const mockInvalidateProfile = jest.fn().mockResolvedValue(undefined);
const mockInvalidateNations = jest.fn().mockResolvedValue(undefined);
const mockNotify = { success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() };

jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: { myNations: { useQuery: () => ({ data: mockData }) } },
    users: {
      setActiveNation: {
        useMutation: (opts: MutationOptions) => {
          mutationOptions = opts;
          return { mutate: mockMutate, isPending: false };
        },
      },
    },
    useUtils: () => ({
      users: { getProfile: { invalidate: mockInvalidateProfile } },
      realms: { myNations: { invalidate: mockInvalidateNations } },
    }),
  },
}));

const nation = (id: string, name: string) => ({ id, name, slug: id, flag: null });

describe("NationSwitcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mutationOptions = {};
  });

  it("renders nothing for a player with fewer than two nations", () => {
    mockData = {
      activeCountryId: "c1",
      dividendCountryId: "c1",
      realms: [
        { id: "default", slug: "ixworld", name: "IxWorld", nations: [nation("c1", "Aurelia")] },
      ],
    };
    const { container } = render(<NationSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists nations grouped by realm, marks the active one, and switches to another", async () => {
    mockData = {
      activeCountryId: "c1",
      dividendCountryId: "c1",
      realms: [
        { id: "default", slug: "ixworld", name: "IxWorld", nations: [nation("c1", "Aurelia")] },
        {
          id: "eurth",
          slug: "eurth",
          name: "Eurth",
          nations: [nation("e1", "Brava"), nation("e2", "Dorn")],
        },
      ],
    };
    const onSwitched = jest.fn();
    render(<NationSwitcher onSwitched={onSwitched} />);

    expect(screen.getByRole("group", { name: "IxWorld" })).toHaveTextContent("Aurelia");
    expect(screen.getByRole("group", { name: "Eurth" })).toHaveTextContent("BravaDorn");
    const active = screen.getByRole("button", { name: /Aurelia/ });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(active).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Dorn" }));
    expect(mockMutate).toHaveBeenCalledWith({ countryId: "e2" });

    await mutationOptions.onSuccess?.();
    await waitFor(() => expect(onSwitched).toHaveBeenCalledTimes(1));
    expect(mockInvalidateProfile).toHaveBeenCalledTimes(1);
    expect(mockInvalidateNations).toHaveBeenCalledTimes(1);
  });

  it("reports a refused switch", () => {
    mockData = {
      activeCountryId: null,
      dividendCountryId: "c1",
      realms: [
        {
          id: "default",
          slug: "ixworld",
          name: "IxWorld",
          nations: [nation("c1", "Aurelia"), nation("c2", "Cadiz")],
        },
      ],
    };
    render(<NationSwitcher />);
    mutationOptions.onError?.({ message: "You can only play as a nation you own" });
    expect(mockNotify.error).toHaveBeenCalledWith(
      "Could not switch nation",
      "You can only play as a nation you own"
    );
  });
});
