"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
};

export function FormField({ label, children, hint, error, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-semibold text-black/85">{label}</label>
      {children}
      {hint ? <div className="text-xs text-black/60">{hint}</div> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function FormSelect({ className, ...props }: FormSelectProps) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-[#b5cec4] bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
