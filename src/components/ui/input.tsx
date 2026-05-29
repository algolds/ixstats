import * as React from "react";

import { cn } from "~/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground",
        "flex h-9 w-full min-w-0 rounded-md border border-white/[0.08] bg-white/[0.02] dark:border-white/[0.06] dark:bg-white/[0.015]",
        "px-3 py-1 text-base shadow-xs transition-all duration-200 outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus:scale-[1.01] focus:border-amber-500/60 focus:bg-white/80 focus:shadow-lg focus:ring-[2.5px] focus:shadow-amber-500/20 focus:ring-amber-500/20 dark:focus:bg-gray-800/90",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
