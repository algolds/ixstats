import * as React from "react";

import { cn } from "~/lib/utils/cn";
import { fieldStyles } from "~/components/ui/input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldStyles,
        "flex field-sizing-content min-h-16 w-full rounded-control px-3 py-2 text-base md:text-body",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
