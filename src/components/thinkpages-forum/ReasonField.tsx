import { useId } from "react";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

interface ReasonFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * A labelled text field with a character counter, for the forum's report, warning, ban and appeal dialogs. The field
 * caps the raw text at `max` and the counter counts that same text, so no length check is needed past it.
 */
export function ReasonField({
  label,
  value,
  onChange,
  max,
  disabled,
  placeholder,
}: ReasonFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        rows={4}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-caption text-label-secondary text-right tabular-nums">{`${value.length} / ${max}`}</p>
    </div>
  );
}

/** A dialog's inline error, read out when it appears. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="bg-destructive/10 text-destructive text-footnote rounded-control px-3 py-2"
    >
      {message}
    </p>
  );
}
