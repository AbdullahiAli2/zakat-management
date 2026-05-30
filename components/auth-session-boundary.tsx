"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { resetAuthCache } from "@/lib/auth-client";

export function AuthSessionBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isAuthPage = pathname === "/login" || pathname === "/register";

  React.useEffect(() => {
    if (isAuthPage) {
      resetAuthCache();
    }
  }, [isAuthPage, pathname]);

  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
