import React from "react";
import { cn } from "~/lib/utils";
import {
  GHOST_BUTTON,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "~/components/mycountry/shell/surface-kit";

const VARIANT_CLASS = {
  primary: PRIMARY_BUTTON,
  secondary: SECONDARY_BUTTON,
  ghost: GHOST_BUTTON,
} as const;

export interface KitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASS;
}

/**
 * A button styled with the MyCountry shell kit (shell/surface-kit.tsx), so directive actions
 * match the dashboard: amber primary, gray secondary, borderless ghost, 44px tall on phones.
 */
export const KitButton = React.forwardRef<HTMLButtonElement, KitButtonProps>(function KitButton(
  { variant = "secondary", type = "button", className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        VARIANT_CLASS[variant],
        "whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
});
