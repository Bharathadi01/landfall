import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Render-prop so the control gets the generated id and aria wiring. */
  children: (a11y: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-d` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, "aria-describedby": descId, "aria-invalid": error ? true : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn("mt-1.5 text-[12.5px]", error ? "text-danger" : "text-ink-3")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...p },
  ref
) {
  return <input ref={ref} className={cn("field-input", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...p }, ref) {
    return <textarea ref={ref} className={cn("field-input", className)} {...p} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...p },
  ref
) {
  return (
    <select ref={ref} className={cn("field-input", className)} {...p}>
      {children}
    </select>
  );
});
