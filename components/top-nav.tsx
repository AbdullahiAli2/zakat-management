"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { logoutClientSession } from "@/lib/auth-client";
import { useGetNotificationsQuery, useMarkNotificationsReadMutation } from "@/store/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAtom } from "jotai";
import { sidebarCollapsedAtom } from "@/state/uiAtoms";
import { Bell, KeyRound, LogOut, Menu, User, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export function TopNav() {
  const router = useRouter();
  const { me, isBootstrapping } = useAuth();
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const {
    data: notifications,
    refetch: refetchNotifications,
    isFetching: notificationsLoading,
  } = useGetNotificationsQuery({ page: 1, pageSize: 8 }, { skip: isBootstrapping || !me });

  const [markRead, { isLoading: markingRead }] = useMarkNotificationsReadMutation();

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutClientSession();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Logout failed");
    } finally {
      setLoggingOut(false);
    }
  }

  async function onMarkAllRead() {
    try {
      await markRead({ all: true }).unwrap();
      await refetchNotifications();
      toast.success("Notifications cleared");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  }

  return (
    <header className="z-40 flex w-full max-w-full shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-[#c8d3df] bg-white px-4 py-3">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-[#475569] hover:bg-[#f7f8f9]"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative shrink-0">
              <Bell className="h-4 w-4" />
              {notifications?.unreadCount ? (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-none text-white">
                  {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[320px] max-w-[calc(100vw-2rem)]">
            <div className="px-2 py-2 text-xs font-semibold text-black/60">Notifications</div>
            {notificationsLoading ? (
              <div className="px-2 pb-2 text-sm text-black/60">Loading...</div>
            ) : notifications?.items?.length ? (
              notifications.items.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1">
                  <div className="text-sm font-medium text-black">{n.title}</div>
                  <div className="text-xs text-black/60 line-clamp-2">{n.message}</div>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 pb-2 text-sm text-black/60">No notifications</div>
            )}
            <div className="px-2 py-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={onMarkAllRead}
                disabled={markingRead || !notifications?.unreadCount}
              >
                Mark all read
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Profile">
              {me?.avatarUrl ? (
                <Image src={me.avatarUrl} alt="Profile" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[240px] max-w-[calc(100vw-2rem)]">
            <div className="px-3 py-2">
              <div className="mb-2 flex items-center justify-center">
                {me?.avatarUrl ? (
                  <Image
                    src={me.avatarUrl}
                    alt="Profile"
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-full border border-black/10 object-cover"
                  />
                ) : (
                  <UserCircle2 className="h-12 w-12 text-[#065F46]" />
                )}
              </div>
              <div className="text-sm font-semibold text-black">{me?.name ?? "User"}</div>
              <div className="text-xs text-black/60">{me?.email ?? ""}</div>
              <div className="mt-2 text-xs font-medium text-[#065F46]">{me?.role ?? ""}</div>
            </div>
            <DropdownMenuItem className="cursor-pointer text-black/90" onClick={() => router.push("/profile")}>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-black/90"
              onClick={() => router.push("/profile?changePassword=1")}
            >
              <KeyRound className="mr-2 h-4 w-4" /> Change Password
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-black/90" onClick={onLogout} disabled={loggingOut}>
              <LogOut className="mr-2 h-4 w-4" /> {loggingOut ? "Logging out..." : "Logout"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
