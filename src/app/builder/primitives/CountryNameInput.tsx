import { Building } from "lucide-react";

interface CountryNameInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CountryNameInput({ value, onChange, placeholder }: CountryNameInputProps) {
  return (
    <div className="mb-6">
      <label className="form-label">
        <Building className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
        Country Name
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-input"
        placeholder={placeholder}
      />
    </div>
  );
}