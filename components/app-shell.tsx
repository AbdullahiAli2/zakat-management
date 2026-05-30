"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SystemFooter } from "@/components/system-footer";

function isDashboardRoute(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/donor") ||
    pathname.startsWith("/profile")
  );
}

function isAuthRoute(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const dashboard = isDashboardRoute(pathname);
  const authPage = isAuthRoute(pathname);

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col">
      <main
        className={cn(
          "flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col",
          dashboard ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden",
        )}
      >
        {children}
      </main>
      {!dashboard && !authPage ? <SystemFooter className="bg-white" /> : null}
    </div>
  );
}
