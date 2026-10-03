"use client";

/**
 * FacetList / FacetListSection / FacetRow: the inset grouped list.
 *
 *   <FacetList>
 *     <FacetListSection header="Account" footer="Shown on your public profile.">
 *       <FacetRow leading={<User />} title="Name" trailing="Ada" accessory="chevron" href="/me" />
 *       <FacetRow title="Sign out" destructive onClick={signOut} />
 *     </FacetListSection>
 *   </FacetList>
 *
 * Sections stack 24px apart. A section's header (sentence case `text-subhead`) and footer
 * (`text-footnote`) sit outside the group; the group is an opaque `surface` with rows separated by
 * `separator` hairlines inset to the text (not under the leading icon). Rows are ≥44px; rows with
 * `href` render a Next `<Link>`, rows with `onClick` a `<button>`, others a static item.
 */

import * as React from "react";
import Link from "next/link";
import { Check, NavArrowRight } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { SwipeableRow, SwipeActionButton } from "~/components/ui/facet/swipeable/SwipeableRow";
import type { SwipeAction, SwipeCommitAction } from "~/components/ui/facet/swipeable/types";

// ─── List & section ─────────────────────────────────────────────────────────

/**
 * `"inset"` (default): each section is an opaque rounded group — for grouped pages and sheets.
 * `"plain"`: no group background or radius — for a list inside a `Card`.
 */
export type FacetListVariant = "inset" | "plain";

const ListVariantContext = React.createContext<FacetListVariant>("inset");

export interface FacetListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: FacetListVariant;
}

/** A vertical stack of `FacetListSection`s (24px apart). */
export const FacetList = React.forwardRef<HTMLDivElement, FacetListProps>(
  ({ variant = "inset", className, ...props }, ref) => (
    <ListVariantContext.Provider value={variant}>
      <div
        ref={ref}
        data-slot="facet-list"
        className={cn("flex flex-col gap-6", className)}
        {...props}
      />
    </ListVariantContext.Provider>
  )
);
FacetList.displayName = "FacetList";

export interface FacetListSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Sentence-case header above the group. */
  header?: React.ReactNode;
  /** Helper text below the group. */
  footer?: React.ReactNode;
  /** Element for the header (default `h3`) — match the page outline. */
  headerAs?: "h2" | "h3" | "h4" | "div";
  /** Override the list's variant for this section. */
  variant?: FacetListVariant;
  /** Extra classes for the rounded group (`<ul>`). */
  groupClassName?: string;
  /** Accessible name for the group when there is no visible `header`. */
  "aria-label"?: string;
}

export const FacetListSection = React.forwardRef<HTMLElement, FacetListSectionProps>(
  (
    {
      header,
      footer,
      headerAs: Header = "h3",
      variant: variantProp,
      groupClassName,
      className,
      children,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const listVariant = React.useContext(ListVariantContext);
    const variant = variantProp ?? listVariant;
    const headerId = React.useId();
    const footerId = React.useId();
    const inset = variant === "inset";

    return (
      <section
        ref={ref}
        data-slot="facet-list-section"
        className={cn("flex flex-col", className)}
        {...props}
      >
        {header != null && header !== false && (
          <Header
            id={headerId}
            className={cn("text-subhead text-label-secondary pb-2", inset ? "px-4" : "px-0")}
          >
            {header}
          </Header>
        )}
        <ul
          // Explicit role: Safari drops list semantics from `list-style: none` lists.
          // oxlint-disable-next-line jsx-a11y/no-redundant-roles
          role="list"
          aria-labelledby={header != null && header !== false ? headerId : undefined}
          aria-label={header != null && header !== false ? undefined : ariaLabel}
          aria-describedby={footer != null && footer !== false ? footerId : undefined}
          data-variant={variant}
          className={cn(
            "flex flex-col",
            inset && "bg-surface border-separator rounded-row overflow-hidden border",
            groupClassName
          )}
        >
          {children}
        </ul>
        {footer != null && footer !== false && (
          <p
            id={footerId}
            className={cn("text-footnote text-label-secondary pt-2", inset ? "px-4" : "px-0")}
          >
            {footer}
          </p>
        )}
      </section>
    );
  }
);
FacetListSection.displayName = "FacetListSection";

// ─── Row ────────────────────────────────────────────────────────────────────

export type FacetRowAccessory = "chevron" | "check" | "none" | React.ReactNode;

export interface FacetRowSwipeActions {
  /** Revealed by swiping right. */
  leading?: SwipeAction[];
  /** Revealed by swiping left. */
  trailing?: SwipeAction[];
  /** Full swipe right. */
  leadingCommit?: SwipeCommitAction;
  /** Full swipe left (also Delete/Backspace when the row itself is focused, i.e. a static row). */
  trailingCommit?: SwipeCommitAction;
}

interface FacetRowBaseProps {
  /** Icon, avatar or flag before the text. Decorative icons take `label-secondary`. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Value text (secondary, tabular), a Badge, or any node. */
  trailing?: React.ReactNode;
  /**
   * `"chevron"` (navigates), `"check"` (shown when `selected`), `"none"`, or a custom node.
   * Defaults to `"chevron"` for `href` rows and none otherwise.
   */
  accessory?: FacetRowAccessory;
  /** Selected state: fill highlight + check accessory; `aria-current` / `aria-pressed`. */
  selected?: boolean;
  /**
   * How `selected` looks. `"fill"` (default): a neutral `fill-3` highlight — pickers with a check.
   * `"tint"`: a `tint-fill` highlight with a tinted leading icon — the current item of a
   * master–detail list or rail. A tint button row also reports `aria-current="true"` when
   * selected (unless it is a check toggle, which keeps `aria-pressed`).
   */
  selectionStyle?: "fill" | "tint";
  /**
   * Overrides the row's `aria-current` (links default to `"page"` when selected; tint button rows
   * to `"true"`). Pass `false` to suppress it.
   */
  "aria-current"?: React.AriaAttributes["aria-current"];
  disabled?: boolean;
  /** Destructive action (red title and icon). */
  destructive?: boolean;
  /**
   * Optional swipe actions (`SwipeableRow`). Keyboard users open the same actions as a menu with
   * Shift+F10 or the ContextMenu key on the focused row.
   */
  swipeActions?: FacetRowSwipeActions;
  className?: string;
  /** Classes for the `<li>`. */
  itemClassName?: string;
  id?: string;
  "aria-label"?: string;
}

export interface FacetRowLinkProps extends FacetRowBaseProps {
  href: React.ComponentProps<typeof Link>["href"];
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  target?: string;
  rel?: string;
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
}

export interface FacetRowButtonProps extends FacetRowBaseProps {
  href?: undefined;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export type FacetRowProps = FacetRowLinkProps | FacetRowButtonProps;

/** Pressable rows: fill washes, the focus ring and a subtle press. */
const ROW_INTERACTIVE =
  "hover:bg-fill-4 active:bg-fill-3 focus-visible:outline-tint cursor-pointer facet-press facet-press-subtle focus-visible:outline-2 focus-visible:-outline-offset-2";

function RowAccessory({
  accessory,
  selected,
}: {
  accessory: FacetRowAccessory;
  selected: boolean;
}) {
  if (accessory === "none" || accessory == null || accessory === false) return null;
  if (accessory === "chevron") {
    return <NavArrowRight aria-hidden className="text-label-tertiary size-4 shrink-0" />;
  }
  if (accessory === "check") {
    return (
      <Check
        aria-hidden
        data-slot="facet-row-check"
        className={cn("text-tint size-4 shrink-0", !selected && "invisible")}
      />
    );
  }
  return <span className="flex shrink-0 items-center">{accessory}</span>;
}

export const FacetRow = React.forwardRef<HTMLElement, FacetRowProps>((props, ref) => {
  const {
    leading,
    title,
    subtitle,
    trailing,
    accessory: accessoryProp,
    selected = false,
    selectionStyle = "fill",
    disabled = false,
    destructive = false,
    swipeActions,
    className,
    itemClassName,
    id,
    "aria-label": ariaLabel,
    "aria-current": ariaCurrentProp,
  } = props;
  const tintSelected = selected && selectionStyle === "tint";

  const isLink = props.href !== undefined && !disabled;
  const isButton = !isLink && props.onClick !== undefined;
  const accessory: FacetRowAccessory =
    accessoryProp ?? (props.href !== undefined ? "chevron" : "none");

  const trailingNode =
    typeof trailing === "string" || typeof trailing === "number" ? (
      <span className="text-body text-label-secondary truncate tabular-nums">{trailing}</span>
    ) : (
      trailing
    );

  const content = (
    <>
      {leading != null && leading !== false && (
        <span
          data-slot="facet-row-leading"
          className={cn(
            "flex shrink-0 items-center justify-center self-center py-2 pr-3",
            destructive ? "text-destructive" : tintSelected ? "text-tint" : "text-label-secondary"
          )}
        >
          {leading}
        </span>
      )}
      {/* The text column carries the hairline, so separators are inset to the text start. */}
      <span
        data-slot="facet-row-body"
        className="border-separator flex min-h-11 min-w-0 flex-1 items-center gap-3 border-t py-3 pr-4 group-first/row:border-t-0"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "text-headline break-words",
              destructive ? "text-destructive" : "text-label"
            )}
          >
            {title}
          </span>
          {subtitle != null && subtitle !== false && (
            <span className="text-footnote text-label-secondary break-words">{subtitle}</span>
          )}
        </span>
        {trailingNode != null && trailingNode !== false && (
          <span className="flex max-w-[50%] shrink-0 items-center justify-end">{trailingNode}</span>
        )}
        <RowAccessory accessory={accessory} selected={selected} />
        {selected && accessory !== "check" && !isLink && !isButton && (
          <span className="sr-only">Selected</span>
        )}
      </span>
    </>
  );

  const rowClass = cn(
    "flex w-full items-stretch pl-4 text-left",
    selected && (selectionStyle === "tint" ? "bg-tint-fill" : "bg-fill-3"),
    (isLink || isButton) && ROW_INTERACTIVE,
    // Keep the tint highlight under the pointer so the current row stays identifiable.
    tintSelected && (isLink || isButton) && "hover:bg-tint-fill active:bg-tint-fill",
    disabled && "cursor-not-allowed opacity-50",
    swipeActions && !selected && "bg-surface",
    className
  );

  let row: React.ReactElement;
  if (isLink) {
    const { href, onClick, target, rel, prefetch, scroll, replace } = props as FacetRowLinkProps;
    row = (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        id={id}
        href={href}
        onClick={onClick}
        target={target}
        rel={rel}
        prefetch={prefetch}
        scroll={scroll}
        replace={replace}
        aria-label={ariaLabel}
        aria-current={
          ariaCurrentProp !== undefined ? ariaCurrentProp : selected ? "page" : undefined
        }
        data-slot="facet-row"
        className={rowClass}
      >
        {content}
      </Link>
    );
  } else if (isButton) {
    const { onClick } = props as FacetRowButtonProps;
    row = (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={accessory === "check" ? selected : undefined}
        aria-current={
          ariaCurrentProp !== undefined
            ? ariaCurrentProp
            : tintSelected && accessory !== "check"
              ? "true"
              : undefined
        }
        data-slot="facet-row"
        className={rowClass}
      >
        {content}
      </button>
    );
  } else {
    row = (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        id={id}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        aria-current={ariaCurrentProp}
        data-slot="facet-row"
        className={rowClass}
      >
        {content}
      </div>
    );
  }

  const hasSwipe =
    !!swipeActions &&
    ((swipeActions.leading?.length ?? 0) > 0 || (swipeActions.trailing?.length ?? 0) > 0);

  return (
    <li
      data-slot="facet-row-item"
      data-selected={selected || undefined}
      data-selection-style={selected ? selectionStyle : undefined}
      className={cn("group/row relative list-none", itemClassName)}
    >
      {hasSwipe && swipeActions ? (
        <SwipeableRow disabled={disabled}>
          {swipeActions.leading && swipeActions.leading.length > 0 && (
            <SwipeableRow.Leading commit={swipeActions.leadingCommit}>
              {swipeActions.leading.map((action) => (
                <SwipeActionButton key={action.id} {...action} />
              ))}
            </SwipeableRow.Leading>
          )}
          {swipeActions.trailing && swipeActions.trailing.length > 0 && (
            <SwipeableRow.Trailing commit={swipeActions.trailingCommit}>
              {swipeActions.trailing.map((action) => (
                <SwipeActionButton key={action.id} {...action} />
              ))}
            </SwipeableRow.Trailing>
          )}
          <SwipeableRow.Content className="cursor-auto active:cursor-auto">
            {row}
          </SwipeableRow.Content>
        </SwipeableRow>
      ) : (
        row
      )}
    </li>
  );
});
FacetRow.displayName = "FacetRow";
