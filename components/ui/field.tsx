"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

const baseField =
  "w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-[15px] text-foreground " +
  "placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none " +
  "focus:ring-2 focus:ring-primary/25 disabled:opacity-60";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(baseField, className)} {...props} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(baseField, "min-h-20 resize-y", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(baseField, "appearance-none bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Campo de contraseña con el clásico ojito para mostrarla u ocultarla. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="relative">
      <input
        ref={ref}
        id={props.id ?? id}
        type={visible ? "text" : "password"}
        className={cn(baseField, "pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  );
});

export function FormMessage({
  state,
}: {
  state: { ok: boolean; error?: string; message?: string };
}) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
      >
        {state.error}
      </p>
    );
  }

  if (state.ok && state.message) {
    return (
      <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-medium text-success">
        {state.message}
      </p>
    );
  }

  return null;
}
