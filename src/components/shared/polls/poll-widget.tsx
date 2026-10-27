"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cva } from "class-variance-authority";
import { StatsReport as BarChart3Icon, Check as CheckIcon } from "iconoir-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "~/lib/utils/cn";
import { Button } from "~/components/ui/button";

interface PollOption {
  id: string;
  label: string;
  description?: string;
}

/** idle → voting (submit pressed) → results (vote recorded) → success (confirmation) → idle */
type AnimationPhase = "idle" | "voting" | "results" | "success";

interface PollWidgetRootProps {
  question: string;
  description?: string;
  options: PollOption[];
  /** Selected option id(s); the widget is controlled. */
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Vote counts per option */
  votes?: Record<string, number>;
  /** Whether the user has already voted (shows results) */
  hasVoted?: boolean;
  onVote?: (selectedIds: string[]) => void;
  children: ReactNode;
}

interface PollWidgetContextValue {
  question: string;
  description?: string;
  options: PollOption[];
  selected: string[];
  multiple: boolean;
  disabled: boolean;
  showResults: boolean;
  totalVotes: number;
  hasVoted: boolean;
  select: (optionId: string) => void;
  getPercentage: (optionId: string) => number;
  submitVote: () => void;
  canSubmit: boolean;
  animationPhase: AnimationPhase;
}

const PollWidgetContext = createContext<PollWidgetContextValue | null>(null);

function usePollWidget() {
  const context = useContext(PollWidgetContext);
  if (!context) {
    throw new Error("PollWidget components must be used within PollWidget.Root");
  }
  return context;
}

const OPTION_CLASSES = [
  "group relative flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left",
  "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
];

const optionVariants = cva(OPTION_CLASSES, {
  variants: {
    state: {
      idle: ["border-border bg-background hover:border-poll/50 hover:bg-poll/5"],
      selected: ["border-poll/55 bg-poll/5 shadow-xs", "hover:border-poll hover:bg-poll/10"],
      voted: ["cursor-default border-border bg-muted/30"],
    },
  },
  defaultVariants: { state: "idle" },
});

const indicatorVariants = cva(
  [
    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
    "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-out",
  ],
  {
    variants: {
      state: {
        idle: "border-muted-foreground/30 bg-background",
        selected: "border-poll bg-poll text-white",
        voted: "border-muted-foreground/30 bg-muted",
      },
      multiple: { true: "rounded-sm", false: "rounded-full" },
    },
    defaultVariants: { state: "idle", multiple: false },
  }
);

const progressVariants = cva(
  [
    "absolute inset-y-0 left-0 rounded-l-lg",
    "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 ease-out",
  ],
  {
    variants: { state: { idle: "bg-transparent", selected: "bg-poll/15", voted: "bg-poll/10" } },
    defaultVariants: { state: "idle" },
  }
);

/** Brief pause before the vote is sent, how long results show, and how long the confirmation stays. */
const VOTE_DELAY_MS = 400;
const RESULTS_DURATION_MS = 2500;
const SUCCESS_DURATION_MS = 1500;

/** Root: owns the selection / vote animation state and provides it to the compound parts. */
function PollWidgetRoot({
  question,
  description,
  options,
  value,
  onValueChange,
  multiple = false,
  disabled = false,
  votes = {},
  hasVoted = false,
  onVote,
  children,
}: PollWidgetRootProps) {
  const selected = useMemo(() => (value ? (Array.isArray(value) ? value : [value]) : []), [value]);
  const [phase, setAnimationPhase] = useState<AnimationPhase>("idle");
  // A vote cast elsewhere (or earlier) goes straight to results
  const animationPhase = hasVoted && phase === "idle" ? "results" : phase;

  const totalVotes = useMemo(
    () => Object.values(votes).reduce((sum, count) => sum + count, 0),
    [votes]
  );

  const select = useCallback(
    (optionId: string) => {
      if (disabled || hasVoted || animationPhase !== "idle") return;
      const next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : multiple
          ? [...selected, optionId]
          : [optionId];
      onValueChange?.(multiple ? next : (next[0] ?? ""));
    },
    [disabled, hasVoted, multiple, selected, onValueChange, animationPhase]
  );

  const getPercentage = useCallback(
    (optionId: string) =>
      totalVotes === 0 ? 0 : Math.round(((votes[optionId] ?? 0) / totalVotes) * 100),
    [votes, totalVotes]
  );

  const submitVote = useCallback(() => {
    if (selected.length === 0 || !onVote || animationPhase !== "idle") return;
    setAnimationPhase("voting");
    setTimeout(() => {
      onVote(selected);
      setAnimationPhase("results");
      setTimeout(() => {
        setAnimationPhase("success");
        setTimeout(() => setAnimationPhase("idle"), SUCCESS_DURATION_MS);
      }, RESULTS_DURATION_MS);
    }, VOTE_DELAY_MS);
  }, [selected, onVote, animationPhase]);

  const contextValue = useMemo<PollWidgetContextValue>(
    () => ({
      question,
      description,
      options,
      selected,
      multiple,
      disabled,
      showResults: hasVoted || animationPhase === "results",
      totalVotes,
      hasVoted,
      select,
      getPercentage,
      submitVote,
      canSubmit: selected.length > 0 && !hasVoted && !disabled && animationPhase === "idle",
      animationPhase,
    }),
    [
      question,
      description,
      options,
      selected,
      multiple,
      disabled,
      hasVoted,
      totalVotes,
      select,
      getPercentage,
      submitVote,
      animationPhase,
    ]
  );

  return (
    <PollWidgetContext.Provider value={contextValue}>
      <div data-mode="inline" data-slot="poll-widget">
        {children}
      </div>
    </PollWidgetContext.Provider>
  );
}

const SPRING_TRANSITION = { type: "spring", duration: 0.4, bounce: 0 } as const;

/** Poll content; swaps to the confirmation panel after a vote and back. */
function PollWidgetContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { animationPhase } = usePollWidget();

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      data-animation-phase={animationPhase}
      data-slot="poll-widget-content"
      {...props}
    >
      <AnimatePresence mode="popLayout">
        {animationPhase === "success" ? (
          <motion.div
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            className="flex h-full min-h-[120px] flex-col items-center justify-center"
            exit={{ y: 32, opacity: 0, filter: "blur(4px)" }}
            initial={{ y: -32, opacity: 0, filter: "blur(4px)" }}
            key="success"
            transition={SPRING_TRANSITION}
          >
            <PollWidgetSuccess />
          </motion.div>
        ) : (
          <motion.div
            className="flex flex-col gap-3"
            exit={{ y: 8, opacity: 0, filter: "blur(4px)" }}
            initial={false}
            key="poll-content"
            transition={SPRING_TRANSITION}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Confirmation shown after voting: animated checkmark, the chosen options and the total. */
function PollWidgetSuccess() {
  const { totalVotes, selected, options } = usePollWidget();
  const votedOptions = selected
    .map((id) => options.find((o) => o.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="flex flex-col items-center gap-2 text-center" data-slot="poll-widget-success">
      <motion.div
        animate={{ scale: 1, opacity: 1 }}
        initial={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.4, delay: 0.1 }}
      >
        <svg
          aria-hidden="true"
          className="-mt-1"
          fill="none"
          height="40"
          viewBox="0 0 32 32"
          width="40"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Success</title>
          <path
            className="fill-primary/20"
            d="M27.6 16C27.6 17.5234 27.3 19.0318 26.717 20.4392C26.1341 21.8465 25.2796 23.1253 24.2025 24.2025C23.1253 25.2796 21.8465 26.1341 20.4392 26.717C19.0318 27.3 17.5234 27.6 16 27.6C14.4767 27.6 12.9683 27.3 11.5609 26.717C10.1535 26.1341 8.87475 25.2796 7.79759 24.2025C6.72043 23.1253 5.86598 21.8465 5.28302 20.4392C4.70007 19.0318 4.40002 17.5234 4.40002 16C4.40002 12.9235 5.62216 9.97301 7.79759 7.79759C9.97301 5.62216 12.9235 4.40002 16 4.40002C19.0765 4.40002 22.027 5.62216 24.2025 7.79759C26.3779 9.97301 27.6 12.9235 27.6 16Z"
          />
          <path
            className="stroke-primary"
            d="M12.1334 16.9667L15.0334 19.8667L19.8667 13.1M27.6 16C27.6 17.5234 27.3 19.0318 26.717 20.4392C26.1341 21.8465 25.2796 23.1253 24.2025 24.2025C23.1253 25.2796 21.8465 26.1341 20.4392 26.717C19.0318 27.3 17.5234 27.6 16 27.6C14.4767 27.6 12.9683 27.3 11.5609 26.717C10.1535 26.1341 8.87475 25.2796 7.79759 24.2025C6.72043 23.1253 5.86598 21.8465 5.28302 20.4392C4.70007 19.0318 4.40002 17.5234 4.40002 16C4.40002 12.9235 5.62216 9.97301 7.79759 7.79759C9.97301 5.62216 12.9235 4.40002 16 4.40002C19.0765 4.40002 22.027 5.62216 24.2025 7.79759C26.3779 9.97301 27.6 12.9235 27.6 16Z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
        </svg>
      </motion.div>
      <motion.div
        animate={{ y: 0, opacity: 1 }}
        className="space-y-1"
        initial={{ y: 10, opacity: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <h3 className="text-primary text-sm font-medium">Vote recorded</h3>
        <p className="text-muted-foreground mx-auto max-w-xs text-xs text-pretty">
          Your vote has been recorded
        </p>
        {votedOptions.length > 0 && (
          <p className="text-muted-foreground text-xs">
            You voted for:{" "}
            <span className="text-foreground font-medium">{votedOptions.join(", ")}</span>
          </p>
        )}
        <p className="text-muted-foreground pt-1 text-xs">
          {totalVotes.toLocaleString()} total {totalVotes === 1 ? "vote" : "votes"}
        </p>
      </motion.div>
    </div>
  );
}

function PollWidgetQuestion({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { question, description } = usePollWidget();
  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      data-slot="poll-widget-question"
      {...props}
    >
      <h3 className="text-base font-semibold tracking-tight">{children ?? question}</h3>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
    </div>
  );
}

/** Option list with arrow / Home / End keyboard navigation. */
function PollWidgetOptions({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const options = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[data-slot="poll-widget-option"]:not([disabled])'
      )
    );
    const last = options.length - 1;
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const targets: Record<string, number> = {
      ArrowDown: current < last ? current + 1 : 0,
      ArrowRight: current < last ? current + 1 : 0,
      ArrowUp: current > 0 ? current - 1 : last,
      ArrowLeft: current > 0 ? current - 1 : last,
      Home: 0,
      End: last,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    options[targets[event.key]!]?.focus();
  }, []);

  return (
    <div
      tabIndex={0}
      className={cn("flex flex-col gap-2", className)}
      data-slot="poll-widget-options"
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="listbox"
      {...props}
    >
      {children}
    </div>
  );
}

type PollWidgetOptionProps = Omit<ComponentProps<"button">, "value"> & {
  /** Option id */
  value: string;
  disabled?: boolean;
};

/** One option: selection indicator, label (and description), vote percentage and a progress bar. */
function PollWidgetOption({
  value,
  disabled: optionDisabled = false,
  children,
  className,
  onClick,
  ...props
}: PollWidgetOptionProps) {
  const {
    options,
    disabled: rootDisabled,
    hasVoted,
    showResults,
    multiple,
    selected,
    select,
    getPercentage,
  } = usePollWidget();

  const option = options.find((o) => o.id === value);
  const disabled = rootDisabled || optionDisabled;
  const isSelected = selected.includes(value);
  const percentage = getPercentage(value);
  const state = hasVoted ? "voted" : isSelected ? "selected" : "idle";

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!(event.defaultPrevented || disabled)) select(value);
  };

  return (
    <button
      aria-disabled={disabled || hasVoted}
      aria-selected={isSelected}
      className={cn(optionVariants({ state }), className)}
      data-disabled={disabled ? true : undefined}
      data-percentage={percentage}
      data-selected={isSelected ? true : undefined}
      data-slot="poll-widget-option"
      data-state={state}
      data-value={value}
      disabled={disabled || hasVoted}
      onClick={handleClick}
      role="option"
      type="button"
      {...props}
    >
      {showResults && (
        <motion.span
          animate={{ width: `${percentage}%` }}
          aria-hidden="true"
          className={progressVariants({ state: isSelected ? "selected" : "voted" })}
          initial={{ width: 0 }}
          transition={{ type: "spring", duration: 0.8, bounce: 0.1, delay: 0.1 }}
        />
      )}

      <span className="relative z-10 flex w-full items-center gap-3">
        {children ?? (
          <>
            <span
              aria-hidden="true"
              className={indicatorVariants({ state, multiple })}
              data-slot="poll-widget-indicator"
              data-state={state}
            >
              {isSelected && <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className="flex-1 text-sm font-medium" data-slot="poll-widget-label">
              {option?.label ?? value}
              {option?.description && (
                <span className="text-muted-foreground block text-xs font-normal">
                  {option.description}
                </span>
              )}
            </span>
            {showResults && (
              <span
                className="text-muted-foreground min-w-[3ch] text-right text-xs font-medium tabular-nums"
                data-slot="poll-widget-percentage"
              >
                {percentage}%
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
}

/** Total votes and whether you voted. */
function PollWidgetResults({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { totalVotes, hasVoted } = usePollWidget();
  return (
    <div
      className={cn("text-muted-foreground flex items-center justify-between text-xs", className)}
      data-slot="poll-widget-results"
      {...props}
    >
      {children ?? (
        <>
          <span className="flex items-center gap-1.5">
            <BarChart3Icon className="size-3" />
            {totalVotes.toLocaleString()} {totalVotes === 1 ? "vote" : "votes"}
          </span>
          {hasVoted && (
            <span className="text-primary flex items-center gap-1.5">
              <CheckIcon className="size-3" />
              <span>You voted</span>
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** Submit button; hidden once the vote is in, with a spinner while it is being sent. */
function PollWidgetSubmit({
  className,
  children,
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  const { canSubmit, submitVote, animationPhase } = usePollWidget();
  const isSubmitting = animationPhase === "voting";

  if (animationPhase !== "idle" && !isSubmitting) return null;

  return (
    <Button
      className={cn(
        "bg-poll hover:bg-poll/90 w-full overflow-hidden font-semibold text-white shadow-xs transition-[color,background-color,border-color,box-shadow,opacity,transform]",
        className
      )}
      data-slot="poll-widget-submit"
      disabled={!canSubmit || isSubmitting}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) submitVote();
      }}
      type="button"
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full items-center justify-center gap-2"
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: -20 }}
          key={isSubmitting ? "loading" : "submit"}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          {isSubmitting ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                className="size-3.5 rounded-full border-2 border-current border-t-transparent"
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              />
              Submitting...
            </>
          ) : (
            (children ?? "Submit Vote")
          )}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

export const PollWidget = Object.assign(PollWidgetRoot, {
  Content: PollWidgetContent,
  Question: PollWidgetQuestion,
  Options: PollWidgetOptions,
  Option: PollWidgetOption,
  Results: PollWidgetResults,
  Submit: PollWidgetSubmit,
});
