"use client";

import * as React from "react";
import { AppleSwitch, type AppleSwitchProps } from "~/components/ui/apple-switch";

const Switch = React.forwardRef<HTMLButtonElement, AppleSwitchProps>(
  ({ size = "sm", ...props }, ref) => {
    return <AppleSwitch ref={ref} size={size} {...props} />;
  }
);
Switch.displayName = "Switch";

export { Switch, type AppleSwitchProps as SwitchProps };
