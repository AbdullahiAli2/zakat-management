"use client";

import { cn } from "@/lib/utils";

const COPYRIGHT_YEAR = 2026;

type SystemFooterProps = {
  className?: string;
};

export function SystemFooter({ className }: SystemFooterProps) {
  return (
    <footer className={cn("shrink-0 px-4 py-5 text-center", className)}>
      <p className="text-xs text-[#6b7280]">
        © {COPYRIGHT_YEAR} Online Zakat Management System.
      </p>
    </footer>
  );
}
