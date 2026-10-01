"use client";

import * as React from "react";
import { Search, XmarkCircleSolid } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Input } from "~/components/ui/input";

/**
 * SearchField (spec §7.2): a `type="search"` Input with a leading search icon and a clear button.
 * Escape clears a non-empty field (and is swallowed so it does not also close a surrounding sheet
 * or dialog); on an empty field Escape propagates as usual.
 *
 * Works controlled (`value` + `onChange` / `onValueChange`) or uncontrolled. Clearing dispatches a
 * real `input` event, so `onChange` handlers see the empty value too.
 */
export interface SearchFieldProps extends Omit<React.ComponentProps<"input">, "type" | "size"> {
  /** Called with the new string on every change, including clears. */
  onValueChange?: (value: string) => void;
  /** Called after the field is cleared (button or Escape). */
  onClear?: () => void;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** @default "Clear search" */
  clearLabel?: string;
  /** Class for the wrapping element (layout); `className` styles the input. */
  containerClassName?: string;
}

const sizes = {
  sm: {
    input: "h-(--control-height-sm) rounded-control-sm pl-7 pr-7 md:text-footnote",
    icon: "left-2 size-3.5",
    clear: "right-1 size-6",
  },
  md: {
    input: "h-(--control-height) rounded-control pl-8 pr-8",
    icon: "left-3 size-4",
    clear: "right-2 size-6",
  },
  lg: {
    input: "h-(--control-height-lg) rounded-control-lg pl-9 pr-10",
    icon: "left-3 size-4",
    clear: "right-2 size-7",
  },
} as const;

/** Set an input's value the way the browser would, so React's onChange fires. */
function setNativeValue(input: HTMLInputElement, next: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      onClear,
      onKeyDown,
      size = "md",
      clearLabel = "Clear search",
      placeholder = "Search",
      className,
      containerClassName,
      disabled,
      readOnly,
      ...props
    },
    forwardedRef
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current!, []);
    const isControlled = value !== undefined;
    const [uncontrolled, setUncontrolled] = React.useState(
      defaultValue === undefined ? "" : String(defaultValue)
    );
    const current = isControlled ? String(value ?? "") : uncontrolled;
    const metrics = sizes[size];

    const clear = () => {
      const input = innerRef.current;
      if (!input) return;
      setNativeValue(input, "");
      onClear?.();
      input.focus();
    };

    return (
      <div
        data-slot="search-field"
        className={cn("relative flex w-full min-w-0 items-center", containerClassName)}
      >
        <Search
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-label-secondary",
            metrics.icon
          )}
        />
        <Input
          ref={innerRef}
          type="search"
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(e) => {
            if (!isControlled) setUncontrolled(e.target.value);
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (e.key === "Escape" && e.currentTarget.value !== "" && !readOnly) {
              e.preventDefault();
              e.stopPropagation();
              clear();
            }
          }}
          className={cn(
            "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
            metrics.input,
            className
          )}
          {...props}
        />
        {current !== "" && !disabled && !readOnly && (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={clear}
            data-slot="search-field-clear"
            className={cn(
              "absolute top-1/2 inline-flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-label-tertiary",
              "transition-colors duration-150 hover:text-label-secondary",
              "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
              "[&_svg]:pointer-events-none [:where(&)_svg]:size-4",
              metrics.clear
            )}
          >
            <XmarkCircleSolid />
          </button>
        )}
      </div>
    );
  }
);
SearchField.displayName = "SearchField";
