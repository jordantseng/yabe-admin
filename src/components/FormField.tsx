import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FormFieldProps = {
  label: string;
  children: ReactNode;
  requiredMark?: boolean;
  error?: string;
  className?: string;
  /** When set and `error` is shown, the error paragraph uses this id (for input `aria-describedby`). */
  errorId?: string;
};

function FormField({
  label,
  children,
  requiredMark,
  error,
  className,
  errorId,
}: FormFieldProps) {
  return (
    <label className={cn("block w-full space-y-1", className)}>
      <span className="block text-sm font-medium">
        {label}
        {requiredMark ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      {children}
      {error ? (
        <p
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </label>
  );
}

export default FormField;
