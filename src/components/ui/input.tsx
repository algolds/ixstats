import * as React from "react";

import { cn } from "~/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground",
        "flex h-9 w-full min-w-0 rounded-md border border-border/70 bg-background/40",
        "px-3 py-1 text-base shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 outline-none hover:shadow-xs dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-border hover:bg-background/60",
        "focus-visible:border-ring focus-visible:bg-background/90 focus-visible:ring-[2.5px] focus-visible:ring-ring/25",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
