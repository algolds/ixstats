import * as React from "react";

/** Menu surface: the overlay layer. Each menu adds its own transform origin. */
export const menuSurface = "z-popover min-w-[8rem] rounded-row p-1 facet-overlay text-label";

/**
 * Set to "context" by `ContextMenuContent`: the dropdown item components then render the
 * context-menu primitives, so one items fragment serves both a "More actions" dropdown and a
 * right-click menu.
 */
export const MenuKindContext = React.createContext<"dropdown" | "context">("dropdown");
