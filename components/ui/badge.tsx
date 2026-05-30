"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-black/10 bg-white text-[#065F46]",
        secondary: "border-[#1E40AF]/30 bg-[#1E40AF]/10 text-[#1E40AF]",
        success: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-700",
        danger: "border-red-600/30 bg-red-600/10 text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

