/** Centered spinner with a caption, for a Vexel panel that is still fetching. */
export function LoadingBlock({
  message,
  className = "py-32",
  spinnerClassName = "h-8 w-8",
}: {
  message: string;
  className?: string;
  spinnerClassName?: string;
}) {
  return (
    <div
      className={`text-label-secondary text-footnote flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div
        className={`border-tint animate-spin rounded-full border-2 border-t-transparent ${spinnerClassName}`}
      />
      <span>{message}</span>
    </div>
  );
}
