import type { ViewMode } from "~/components/halo/types";

export type HaloState = { status: "compact" } | { status: "expanded"; view: ViewMode };

export type HaloEvent =
  | { type: "open"; view: ViewMode }
  | { type: "close" }
  | { type: "toggle"; view: ViewMode }
  | {
      type: "plugin-changed";
      firstView: string | null;
      pluginGone: boolean;
      availableViews?: readonly string[];
    };

export const INITIAL_HALO_STATE: HaloState = { status: "compact" };

export function haloReducer(state: HaloState, event: HaloEvent): HaloState {
  switch (event.type) {
    case "open": {
      if (event.view === "compact") {
        return { status: "compact" };
      }
      return { status: "expanded", view: event.view };
    }

    case "close": {
      return { status: "compact" };
    }

    case "toggle": {
      if (event.view === "compact") {
        return { status: "compact" };
      }
      if (state.status === "expanded" && state.view === event.view) {
        return { status: "compact" };
      }
      return { status: "expanded", view: event.view };
    }

    case "plugin-changed": {
      if (state.status === "compact") {
        return state;
      }
      if (!state.view.startsWith("plugin:")) {
        return state;
      }
      if (event.pluginGone) {
        return { status: "compact" };
      }
      const openKey = state.view.slice("plugin:".length);
      const hasOpenView = event.availableViews
        ? event.availableViews.includes(openKey)
        : event.firstView === openKey;
      return hasOpenView ? state : { status: "compact" };
    }
  }
}
