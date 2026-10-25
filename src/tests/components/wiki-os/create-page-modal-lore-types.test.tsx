/**
 * Native lore plan Task 3: WikiOS's create-page flow offers Place and Organisation, and its template reaches the
 * editor through `?prefill=` on the edit URL (which the edit route now reads).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreatePageModal } from "~/components/wiki-os/shared/CreatePageModal";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      checkPageExists: {
        useQuery: () => ({
          isFetching: false,
          refetch: () => Promise.resolve({ data: { exists: false } }),
        }),
      },
    },
  },
}));

function openAt(search: string) {
  window.history.replaceState(null, "", `/wiki?${search}`);
  render(<CreatePageModal open onClose={jest.fn()} />);
}

/** "Next": step 1 awaits the title check, so the click is awaited to its end. */
async function next() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  });
}

/** The prefill on the edit URL the modal navigates to. */
function pushedPrefill(): string {
  const href = mockPush.mock.calls.at(-1)![0] as string;
  return new URLSearchParams(href.slice(href.indexOf("?") + 1)).get("prefill") ?? "";
}

describe("CreatePageModal lore types", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("takes ?type=organisation, shows its fields, and sends the Infobox organization template as the prefill", async () => {
    openAt("title=Imperial%20Senate&type=organisation");

    await next();
    await screen.findByRole("radio", { name: /organisation/i, checked: true });
    await next();
    fireEvent.change(await screen.findByPlaceholderText("e.g. 1012"), {
      target: { value: "1012" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create page/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(pushedPrefill()).toContain("{{Infobox organization");
    expect(pushedPrefill()).toMatch(/\| founded\s+= 1012\n/);
    expect(pushedPrefill()).toMatch(/\| name\s+= Imperial Senate\n/);
  });

  it("offers Place and sends the Infobox settlement template", async () => {
    openAt("title=Venceia&type=place");

    await next();
    await screen.findByRole("radio", { name: /place/i, checked: true });
    await next();
    fireEvent.change(await screen.findByPlaceholderText("e.g. Latium"), {
      target: { value: "Latium" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create page/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(pushedPrefill()).toContain("{{Infobox settlement");
    expect(pushedPrefill()).toMatch(/\| subdivision_name\s+= Latium\n/);
  });

  it("ignores an unknown ?type= (a blank page)", async () => {
    openAt("title=Venceia&type=shrine");

    await next();
    await screen.findByRole("radio", { name: /blank page/i, checked: true });
  });
});
