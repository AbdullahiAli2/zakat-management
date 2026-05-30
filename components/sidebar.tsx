"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAtom } from "jotai";
import { sidebarCollapsedAtom } from "@/state/uiAtoms";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  ChevronDown,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Shield,
  Users,
  UserCircle2,
  Wallet,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

function itemActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin" || href === "/donor") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = itemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[#ecfdf5] text-[#065F46] shadow-sm"
          : "text-[#334155] hover:bg-[#f7f8f9]",
        collapsed && "justify-center px-2",
      )}
    >
      <span
        className={cn(
          "shrink-0",
          active ? "text-[#065F46]" : "text-[#64748b] group-hover:text-[#475569]",
        )}
      >
        {item.icon}
      </span>
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function SectionHeader({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 h-px bg-[#d8dce8]" aria-hidden />;
  return (
    <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold tracking-[0.12em] text-[#94a3b8] first:pt-2">
      {title}
    </div>
  );
}

function SidebarSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-2 px-2 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={String(i)}
          className={cn("h-9 rounded-lg bg-[#dde1ec]/80 animate-pulse", collapsed ? "mx-1" : "")}
        />
      ))}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed] = useAtom(sidebarCollapsedAtom);
  const [permissionOpen, setPermissionOpen] = React.useState(false);
  const { me, permissions, role, isAdmin, isBootstrapping } = useAuth();

  React.useEffect(() => {
    if (itemActive(pathname, "/admin/groups") || itemActive(pathname, "/admin/apply-permissions")) {
      setPermissionOpen(true);
    }
  }, [pathname]);

  React.useEffect(() => {
    setPermissionOpen(false);
  }, [me?.id, role]);

  const permissionSet = React.useMemo(() => new Set(permissions?.permissions ?? []), [permissions]);
  const hasAllPermissions = Boolean(permissions?.all);

  const can = React.useCallback(
    (code?: string) => {
      if (!code) return true;
      return hasAllPermissions || permissionSet.has(code);
    },
    [hasAllPermissions, permissionSet],
  );

  const adminPermissionKeys = React.useMemo(
    () => [
      "USERS_VIEW",
      "AUDIT_VIEW",
      "GROUPS_VIEW",
      "PERMISSIONS_MANAGE",
      "NISAB_VIEW",
      "SYSTEM_WALLET_VIEW",
      "DISTRIBUTIONS_VIEW",
      "RECEIPTS_VIEW",
      "REPORTS_VIEW",
      "REPORTS_GENERATE",
      "USERS_ADD",
      "USERS_EDIT",
      "USERS_DELETE",
      "GROUPS_ADD",
      "GROUPS_EDIT",
      "GROUPS_DELETE",
      "NISAB_EDIT",
      "SYSTEM_WALLET_EDIT",
      "DISTRIBUTIONS_ADD",
      "DISTRIBUTIONS_EDIT",
      "DISTRIBUTIONS_DELETE",
    ],
    [],
  );

  const hasSystemMenuAccess = React.useMemo(() => {
    if (isAdmin) return true;
    if (hasAllPermissions) return true;
    return adminPermissionKeys.some((p) => permissionSet.has(p));
  }, [isAdmin, hasAllPermissions, adminPermissionKeys, permissionSet]);

  const iconClass = "h-[18px] w-[18px]";

  const donorSections: NavSection[] = [
    {
      title: "Dashboard",
      items: [
        {
          href: "/donor",
          label: "Dashboard",
          icon: <LayoutDashboard className={iconClass} />,
          permission: "DASHBOARD_VIEW",
        },
      ],
    },
    {
      title: "Zakat",
      items: [
        {
          href: "/donor/pay-zakat",
          label: "Pay Zakat",
          icon: <HandCoins className={iconClass} />,
          permission: "ZAKAT_PAY",
        },
      ],
    },
    {
      title: "Wallet",
      items: [
        { href: "/donor/accounts", label: "Accounts", icon: <Wallet className={iconClass} /> },
        {
          href: "/donor/transactions",
          label: "Transactions",
          icon: <ScrollText className={iconClass} />,
          permission: "TRANSACTIONS_VIEW",
        },
      ],
    },
  ];

  const adminSections: NavSection[] = [
    {
      title: "Dashboard",
      items: [
        {
          href: "/admin",
          label: "Dashboard",
          icon: <LayoutDashboard className={iconClass} />,
          permission: "DASHBOARD_VIEW",
        },
      ],
    },
    {
      title: "Zakat & Finance",
      items: [
        {
          href: "/admin/transactions",
          label: "Transactions",
          icon: <ScrollText className={iconClass} />,
          permission: "TRANSACTIONS_VIEW",
        },
        {
          href: "/admin/pay-zakat",
          label: "Pay Zakat",
          icon: <HandCoins className={iconClass} />,
          permission: "ZAKAT_PAY",
        },
        {
          href: "/admin/nisab",
          label: "Nisab & Wallet",
          icon: <Shield className={iconClass} />,
          permission: "NISAB_VIEW",
        },
        {
          href: "/admin/receipts",
          label: "Receipts",
          icon: <Receipt className={iconClass} />,
          permission: "RECEIPTS_VIEW",
        },
      ],
    },
    {
      title: "Distribution",
      items: [
        {
          href: "/admin/beneficiaries",
          label: "Beneficiaries",
          icon: <Users className={iconClass} />,
          permission: "DISTRIBUTIONS_VIEW",
        },
        {
          href: "/admin/distributions",
          label: "Distributions",
          icon: <ClipboardList className={iconClass} />,
          permission: "DISTRIBUTIONS_VIEW",
        },
        {
          href: "/admin/community-distributions",
          label: "Community Aid",
          icon: <Activity className={iconClass} />,
          permission: "COMMUNITY_DISTRIBUTIONS_VIEW",
        },
      ],
    },
    {
      title: "Administration",
      items: [
        {
          href: "/admin/users",
          label: "Users",
          icon: <Users className={iconClass} />,
          permission: "USERS_VIEW",
        },
        {
          href: "/admin/reports",
          label: "Reports",
          icon: <BarChart3 className={iconClass} />,
          permission: "REPORTS_VIEW",
        },
        {
          href: "/admin/audit",
          label: "Audit Logs",
          icon: <ClipboardList className={iconClass} />,
          permission: "AUDIT_VIEW",
        },
      ],
    },
  ];

  const sections = hasSystemMenuAccess ? adminSections : donorSections;

  const showPermissionSection = hasSystemMenuAccess && (can("GROUPS_VIEW") || can("PERMISSIONS_MANAGE"));
  const permissionSectionActive =
    itemActive(pathname, "/admin/groups") || itemActive(pathname, "/admin/apply-permissions");

  const roleLabel =
    role === "SUPERUSER" ? "Super Admin" : role === "ADMIN" ? "Administrator" : role === "DONOR" ? "Donor" : role ?? "";

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-[#c8d3df] bg-white transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[72px] sm:w-[272px]",
      )}
    >
      {/* Brand header */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2.5 border-b border-[#c8d3df] bg-gradient-to-r from-[#064e3b] via-[#065F46] to-[#0b5a3f] px-4 py-4 text-white",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20 shadow-sm">
          <HandCoins className="h-5 w-5 text-[#f2d680]" />
        </div>
        {!collapsed ? (
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-[15px] font-bold leading-tight text-white">Online Zakat</div>
            <div className="truncate text-[11px] font-medium text-white/80">Management System</div>
          </div>
        ) : null}
      </div>

      {isBootstrapping ? (
        <SidebarSkeleton collapsed={collapsed} />
      ) : (
        <>
          <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 py-1">
            {sections.map((section) => {
              const visibleItems = section.items.filter((item) => can(item.permission));
              if (visibleItems.length === 0) return null;
              return (
                <div key={section.title}>
                  <SectionHeader title={section.title} collapsed={collapsed} />
                  <div className="flex flex-col gap-0.5">
                    {visibleItems.map((item) => (
                      <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
                    ))}
                  </div>
                </div>
              );
            })}

            {showPermissionSection ? (
              <div>
                <SectionHeader title="Access Control" collapsed={collapsed} />
                <button
                  type="button"
                  title={collapsed ? "Access Control" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                    permissionSectionActive
                      ? "bg-[#ecfdf5] text-[#065F46]"
                      : "text-[#334155] hover:bg-[#f7f8f9]",
                    collapsed && "justify-center px-2",
                  )}
                  onClick={() => setPermissionOpen((v) => !v)}
                >
                  <span
                    className={cn(
                      "shrink-0",
                      permissionSectionActive ? "text-[#065F46]" : "text-[#64748b]",
                    )}
                  >
                    <Shield className={iconClass} />
                  </span>
                  {!collapsed ? (
                    <>
                      <span className="flex-1 truncate text-left">Permissions</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-[#94a3b8] transition-transform duration-200",
                          permissionOpen && "rotate-180",
                        )}
                      />
                    </>
                  ) : null}
                </button>
                {permissionOpen && !collapsed ? (
                  <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l-2 border-[#d8dce8] pl-3">
                    {can("GROUPS_VIEW") ? (
                      <Link
                        href="/admin/groups"
                        className={cn(
                          "rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                          itemActive(pathname, "/admin/groups")
                            ? "bg-[#ecfdf5] text-[#1e293b]"
                            : "text-[#475569] hover:bg-[#f7f8f9]",
                        )}
                      >
                        Groups
                      </Link>
                    ) : null}
                    {can("PERMISSIONS_MANAGE") ? (
                      <Link
                        href="/admin/apply-permissions"
                        className={cn(
                          "rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                          itemActive(pathname, "/admin/apply-permissions")
                            ? "bg-[#ecfdf5] text-[#1e293b]"
                            : "text-[#475569] hover:bg-[#f7f8f9]",
                        )}
                      >
                        Apply Permission
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

          {/* Footer user */}
          <div className="shrink-0 border-t border-[#e2e5ef] p-3">
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-xl border border-[#c8d3df] bg-[#f7f8f9] px-2.5 py-2.5 shadow-sm",
                collapsed && "justify-center px-2",
              )}
            >
              {me?.avatarUrl ? (
                <Image
                  src={me.avatarUrl}
                  alt={me?.name ?? "User"}
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-full border border-[#e2e5ef] object-cover"
                />
              ) : (
                <UserCircle2 className="h-9 w-9 shrink-0 text-[#64748b]" />
              )}
              {!collapsed ? (
                <div className="hidden min-w-0 flex-1 sm:block">
                  <div className="truncate text-sm font-semibold text-[#1e293b]">{me?.name ?? "User"}</div>
                  <div className="truncate text-xs text-[#64748b]">{me?.email ?? ""}</div>
                  {roleLabel ? (
                    <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-[#065F46]">
                      {roleLabel}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
