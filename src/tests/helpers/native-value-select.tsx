/**
 * A native `<select>` in place of `ValueSelect` (Radix Select does not render its options in jsdom). Use with
 * `jest.mock("~/components/ui/value-select", () => jest.requireActual("~/tests/helpers/native-value-select"))`.
 */
interface NativeValueSelectProps {
  options: ReadonlyArray<readonly [string, React.ReactNode]>;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function ValueSelect({
  options,
  value,
  onValueChange,
  placeholder,
  id,
  "aria-label": label,
  "aria-labelledby": labelledBy,
}: NativeValueSelectProps) {
  return (
    <select
      id={id}
      aria-label={label}
      aria-labelledby={labelledBy}
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {value === undefined && <option value="">{placeholder}</option>}
      {options.map(([optionValue, text]) => (
        <option key={optionValue} value={optionValue}>
          {text}
        </option>
      ))}
    </select>
  );
}
