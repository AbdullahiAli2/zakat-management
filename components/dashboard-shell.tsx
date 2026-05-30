"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { SystemFooter } from "@/components/system-footer";
import { useAuth } from "@/hooks/use-auth";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, isBootstrapping, isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isBootstrapping, isAuthenticated, router]);

  return (
    <div
      key={me?.id ?? "auth-loading"}
      className="flex h-full min-h-0 w-full max-w-full flex-1 overflow-hidden bg-[#eef1f4]"
    >
      <div className="h-full shrink-0">
        <Sidebar />
      </div>
      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f7f8f9] p-4">
          {isBootstrapping ? (
            <div className="space-y-3">
              <div className="h-10 w-56 rounded-xl bg-black/5 animate-pulse" />
              <div className="h-32 w-full rounded-xl bg-black/5 animate-pulse" />
            </div>
          ) : (
            children
          )}
        </main>
        <SystemFooter className="border-t border-[#c8d3df] bg-[#f7f8f9]" />
      </div>
    </div>
  );
}
