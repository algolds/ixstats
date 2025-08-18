import { AlertCircle, CheckCircle, HelpCircle } from "lucide-react";

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationDisplayProps {
  errors: ValidationError[];
  className?: string;
}

export function ValidationDisplay({ errors, className = "" }: ValidationDisplayProps) {
  if (errors.length === 0) return null;

  const errorsByType = {
    error: errors.filter(e => e.severity === 'error'),
    warning: errors.filter(e => e.severity === 'warning'),
    info: errors.filter(e => e.severity === 'info'),
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {errorsByType.error.map((error, index) => (
        <div key={`error-${index}`} className="flex items-center text-red-600 text-sm">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error.message}
        </div>
      ))}
      {errorsByType.warning.map((error, index) => (
        <div key={`warning-${index}`} className="flex items-center text-yellow-600 text-sm">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error.message}
        </div>
      ))}
      {errorsByType.info.map((error, index) => (
        <div key={`info-${index}`} className="flex items-center text-blue-600 text-sm">
          <HelpCircle className="h-4 w-4 mr-2" />
          {error.message}
        </div>
      ))}
    </div>
  );
}