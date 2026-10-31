import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/* Form primitives shared by admin editors. Every control has a visible label, help and inline error. */

export const inputClass =
  "w-full rounded-xl border bg-background px-3.5 text-sm transition-colors outline-none placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive/60 aria-invalid:focus-visible:ring-destructive/15 dark:bg-muted/30";

export function Field({
  id,
  label,
  help,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {optional ? <span className="text-xs text-muted-foreground">Optional</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** aria wiring for a control inside <Field>. */
export const describe = (id: string, error?: string | null, help?: unknown) => ({
  id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : help ? `${id}-help` : undefined,
});

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input {...props} className={cn(inputClass, "h-10", className)} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(inputClass, "min-h-20 resize-y py-2.5 leading-relaxed", className)} />;
}

/** The shared Sociotix dropdown (`@/components/ui/select`): same props as a native `<select>`. */
export { Select as SelectInput } from "@/components/ui/select";

/** A segmented single choice built on native radios, so arrow keys work. */
export function Segmented<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-[0.82rem] font-semibold whitespace-nowrap text-muted-foreground transition-colors select-none hover:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-primary/40 sm:flex-none",
              value === o.value && "bg-card text-foreground shadow-sm",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
