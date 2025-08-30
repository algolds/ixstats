import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ErrorDisplayProps {
  errors: { field: string; message: string; severity: 'info' | 'error' | 'warning' }[];
}

export function ErrorDisplay({ errors }: ErrorDisplayProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Alert variant={errors.some(e => e.severity === 'error') ? 'destructive' : 'default'}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-1">
          {errors.slice(0, 3).map((error, index) => (
            <div key={index}>
              <strong>{error.field}:</strong> {error.message}
            </div>
          ))}
          {errors.length > 3 && (
            <div className="text-sm text-muted-foreground">
              ...and {errors.length - 3} more issue{errors.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
