"use client";

import * as React from "react";
import { toast } from "sonner";
import { FadeModal } from "@/components/common/fade-modal";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetUserGroupsQuery,
  useGetUserPermissionsQuery,
  useUpdateUserGroupsMutation,
  useUpdateUserPermissionsMutation,
} from "@/store/api";
import {
  allPermissionsInModules,
  filterModulesByApp,
  formatModuleLabel,
  formatPermissionLabel,
  groupPermissionsByModule,
  moduleFilterOptions,
  type PermissionAssignItem,
} from "@/lib/permission-ui";

type AssignType = "PERMISSIONS" | "GROUPS";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number | null;
  userName?: string;
  userRole?: string;
};

export function UserPermissionsModal({ open, onOpenChange, userId, userName, userRole }: Props) {
  const [assignType, setAssignType] = React.useState<AssignType>("PERMISSIONS");
  const [appsFilter, setAppsFilter] = React.useState("ALL");
  const [permissionMap, setPermissionMap] = React.useState<Record<number, boolean>>({});
  const [groupMap, setGroupMap] = React.useState<Record<number, boolean>>({});

  const isSuperuser = userRole === "SUPERUSER";
  const skip = !open || !userId;

  const {
    data: permissions,
    isFetching: permissionsLoading,
    isError: permissionsError,
    refetch: refetchPermissions,
  } = useGetUserPermissionsQuery({ userId: userId ?? 0 }, { skip });

  const {
    data: groups,
    isFetching: groupsLoading,
    isError: groupsError,
    refetch: refetchGroups,
  } = useGetUserGroupsQuery({ userId: userId ?? 0 }, { skip });

  const [savePermissions, { isLoading: savingPermissions }] = useUpdateUserPermissionsMutation();
  const [saveGroups, { isLoading: savingGroups }] = useUpdateUserGroupsMutation();

  React.useEffect(() => {
    if (!open) {
      setAssignType("PERMISSIONS");
      setAppsFilter("ALL");
    }
  }, [open]);

  React.useEffect(() => {
    const next: Record<number, boolean> = {};
    (permissions ?? []).forEach((p) => {
      next[p.id] = p.enabled;
    });
    setPermissionMap(next);
  }, [permissions]);

  React.useEffect(() => {
    const next: Record<number, boolean> = {};
    (groups ?? []).forEach((g) => {
      next[g.id] = g.enabled;
    });
    setGroupMap(next);
  }, [groups]);

  const permissionModules = React.useMemo(() => {
    const modules = groupPermissionsByModule((permissions ?? []) as PermissionAssignItem[]);
    return {
      modules: filterModulesByApp(modules, appsFilter),
      apps: moduleFilterOptions(modules),
      flat: allPermissionsInModules(modules),
    };
  }, [permissions, appsFilter]);

  const filteredFlat = React.useMemo(
    () => allPermissionsInModules(permissionModules.modules),
    [permissionModules.modules],
  );

  async function onSave() {
    if (!userId) return;
    try {
      if (assignType === "PERMISSIONS") {
        const permissionIds = Object.entries(permissionMap)
          .filter(([, enabled]) => enabled)
          .map(([id]) => Number(id));
        await savePermissions({ userId, permissionIds }).unwrap();
        toast.success("Permissions saved");
        await refetchPermissions();
      } else {
        const groupIds = Object.entries(groupMap)
          .filter(([, enabled]) => enabled)
          .map(([id]) => Number(id));
        await saveGroups({ userId, groupIds }).unwrap();
        toast.success("Groups saved");
        await refetchGroups();
      }
      onOpenChange(false);
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Save failed");
    }
  }

  const saving = savingPermissions || savingGroups;
  const loading = assignType === "PERMISSIONS" ? permissionsLoading : groupsLoading;
  const error = assignType === "PERMISSIONS" ? permissionsError : groupsError;

  return (
    <FadeModal
      open={open}
      onOpenChange={onOpenChange}
      title={userName ? `Permissions — ${userName}` : "Assign Permissions"}
      titleClassName="text-[#065F46] text-lg"
      className="sm:max-w-[720px]"
      bodyClassName="max-h-[min(70vh,640px)] overflow-y-auto"
      onSave={isSuperuser ? undefined : onSave}
      saveLabel="Save"
      saveLoading={saving}
      saveDisabled={loading || Boolean(error)}
      hideFooter={isSuperuser}
    >
      {isSuperuser ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Superusers already have full access. Permission assignment is not required.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={assignType}
              onChange={(e) => setAssignType(e.target.value as AssignType)}
              className="h-10 rounded-md border border-black/15 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
            >
              <option value="PERMISSIONS">Direct permissions</option>
              <option value="GROUPS">Assign groups</option>
            </select>
            {assignType === "PERMISSIONS" ? (
              <select
                value={appsFilter}
                onChange={(e) => setAppsFilter(e.target.value)}
                className="h-10 rounded-md border border-black/15 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
              >
                {permissionModules.apps.map((app) => (
                  <option key={app} value={app}>
                    {formatModuleLabel(app)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load {assignType === "PERMISSIONS" ? "permissions" : "groups"}. Check your access rights.
            </div>
          ) : assignType === "PERMISSIONS" ? (
            filteredFlat.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No permissions found. Run <span className="font-mono">npm run db:seed</span> to seed defaults.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md bg-black/[0.03] px-3 py-2 text-sm text-black">
                  <span className="font-medium">Select all (filtered)</span>
                  <Switch
                    checked={filteredFlat.length > 0 && filteredFlat.every((p) => Boolean(permissionMap[p.id]))}
                    onCheckedChange={(checked) => {
                      setPermissionMap((prev) => {
                        const next = { ...prev };
                        filteredFlat.forEach((p) => {
                          next[p.id] = checked;
                        });
                        return next;
                      });
                    }}
                  />
                </div>
                {permissionModules.modules.map((mod) => (
                  <div key={mod.module} className="rounded-md border border-black/10">
                    <div className="border-b border-black/10 bg-black/[0.04] px-3 py-2 font-semibold text-black">{mod.label}</div>
                    <div className="grid gap-2 p-3 md:grid-cols-2">
                      {mod.items.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">{formatPermissionLabel(p.codename, p.name)}</span>
                            <span className="block font-mono text-[11px] text-black/50">{p.codename}</span>
                          </span>
                          <Switch
                            checked={Boolean(permissionMap[p.id])}
                            onCheckedChange={(checked) => {
                              setPermissionMap((prev) => ({ ...prev, [p.id]: checked }));
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (groups ?? []).length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No groups available. Create groups under Access Control first.
            </div>
          ) : (
            <div className="space-y-2">
              {(groups ?? []).map((g) => (
                <label
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-black"
                >
                  <span className="font-medium">{g.name}</span>
                  <Switch
                    checked={Boolean(groupMap[g.id])}
                    onCheckedChange={(checked) => {
                      setGroupMap((prev) => ({ ...prev, [g.id]: checked }));
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </FadeModal>
  );
}
