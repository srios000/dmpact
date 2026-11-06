import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  flags?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function FormField({
  label,
  htmlFor,
  error,
  hint,
  flags,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {flags}
    </div>
  );
}

export { FormField };
