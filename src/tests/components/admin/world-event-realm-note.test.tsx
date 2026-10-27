/** The world event wizard tells the admin how an event spanning realms runs: on each nation's own realm clock. */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ admin: { getWorldEvents: { invalidate: jest.fn() } } }),
    admin: {
      createWorldEvent: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      simulateWorldEvent: { useQuery: () => ({ data: undefined, isLoading: false }) },
    },
    countries: { getSelectList: { useQuery: () => ({ data: [] }) } },
  },
}));

import {
  EventWizard,
  WORLD_EVENT_REALM_NOTE,
} from "~/app/admin/storyteller/_components/EventWizard";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});

it("says an event across realms runs on each nation's realm clock", () => {
  render(<EventWizard onCreated={jest.fn()} />);
  fireEvent.click(screen.getByRole("radio", { name: /Economic crisis/ }));
  fireEvent.click(screen.getByRole("button", { name: /Next/ }));
  expect(screen.getByText(WORLD_EVENT_REALM_NOTE)).toBeInTheDocument();
  expect(WORLD_EVENT_REALM_NOTE).toMatch(/own realm's clock/);
});
