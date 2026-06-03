"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  useGetGroupPermissionsQuery,
  useGetGroupsQuery,
  useGetUserGroupsQuery,
  useGetUserPermissionsQuery,
  useSearchUsersQuery,
  useUpdateGroupPermissionsMutation,
  useUpdateUserGroupsMutation,
  useUpdateUserPermissionsMutation,
} from "@/store/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  allPermissionsInModules,
  filterModulesByApp,
  formatModuleLabel,
  formatPermissionLabel,
  groupPermissionsByModule,
  moduleFilterOptions,
  type PermissionAssignItem,
} from "@/lib/permission-ui";

type Mode = "GROUP_PERMISSIONS" | "USER_ASSIGN";
type UserAssignType = "USER" | "GROUP";

function modeFromQuery(value: string | null): Mode {
  if (value === "GROUP_PERMISSIONS" || value === "USER_ASSIGN") return value;
  return "USER_ASSIGN";
}

export default function ApplyPermissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = React.useState<Mode>(modeFromQuery(searchParams.get("mode")));
  const [userSearch, setUserSearch] = React.useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = React.useState("");
  const [assignType, setAssignType] = React.useState<UserAssignType>("USER");
  const shouldSearchUsers = debouncedUserSearch.length > 0;
  const { data: users } = useSearchUsersQuery(
    { page: 1, pageSize: 50, q: debouncedUserSearch },
    { skip: !shouldSearchUsers },
  );
  const { data: allGroups } = useGetGroupsQuery();
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);
  const [groupPermissionMap, setGroupPermissionMap] = React.useState<Record<number, boolean>>({});
  const [appsFilter, setAppsFilter] = React.useState("ALL");
  const [groupFilter, setGroupFilter] = React.useState("ALL");

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedUserSearch(userSearch.trim()), 250);
    return () => window.clearTimeout(t);
  }, [userSearch]);
  React.useEffect(() => {
    if (!userSearch.trim()) setSelectedUserId(null);
  }, [userSearch]);

  React.useEffect(() => {
    if (!selectedUserId && users?.items?.length) setSelectedUserId(users.items[0].id);
  }, [users, selectedUserId]);
  React.useEffect(() => {
    if (!selectedGroupId && allGroups?.length) setSelectedGroupId(allGroups[0].id);
  }, [allGroups, selectedGroupId]);
  React.useEffect(() => {
    const qm = modeFromQuery(searchParams.get("mode"));
    setMode(qm);
    const qg = Number(searchParams.get("groupId"));
    if (qm === "GROUP_PERMISSIONS" && Number.isFinite(qg) && qg > 0) setSelectedGroupId(qg);
  }, [searchParams]);

  const {
    data: permissions,
    refetch: refetchPermissions,
    isFetching: permissionsLoading,
    isError: permissionsError,
  } = useGetUserPermissionsQuery({ userId: selectedUserId ?? 0 }, { skip: !selectedUserId });
  const { data: groups, refetch: refetchGroups } = useGetUserGroupsQuery(
    { userId: selectedUserId ?? 0 },
    { skip: !selectedUserId },
  );
  const [saveUserPermissions, { isLoading: savingUserPermissions }] = useUpdateUserPermissionsMutation();
  const [saveUserGroups, { isLoading: savingUserGroups }] = useUpdateUserGroupsMutation();
  const [saveGroupPermissions, { isLoading: savingGroupPermissions }] = useUpdateGroupPermissionsMutation();
  const {
    data: groupPermissions,
    refetch: refetchGroupPermissions,
    isFetching: groupPermissionsLoading,
    isError: groupPermissionsError,
  } = useGetGroupPermissionsQuery({ groupId: selectedGroupId ?? 0 }, { skip: !selectedGroupId });

  React.useEffect(() => {
    if (!groupPermissions) return;
    const next: Record<number, boolean> = {};
    groupPermissions.forEach((p) => {
      next[p.id] = p.enabled;
    });
    setGroupPermissionMap(next);
  }, [groupPermissions]);

  const [userPermissionMap, setUserPermissionMap] = React.useState<Record<number, boolean>>({});
  const [userGroupMap, setUserGroupMap] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    const next: Record<number, boolean> = {};
    (permissions ?? []).forEach((p) => {
      next[p.id] = p.enabled;
    });
    setUserPermissionMap(next);
  }, [permissions]);

  React.useEffect(() => {
    const next: Record<number, boolean> = {};
    (groups ?? []).forEach((g) => {
      next[g.id] = g.enabled;
    });
    setUserGroupMap(next);
  }, [groups]);

  const groupPermissionModules = React.useMemo(() => {
    const modules = groupPermissionsByModule((groupPermissions ?? []) as PermissionAssignItem[]);
    return {
      modules: filterModulesByApp(modules, appsFilter),
      apps: moduleFilterOptions(modules),
    };
  }, [groupPermissions, appsFilter]);

  const filteredUsers = React.useMemo(() => users?.items ?? [], [users]);
  const groupsWithPermissions = React.useMemo(
    () => (allGroups ?? []).filter((g) => g.permissionsCount > 0),
    [allGroups],
  );
  const filteredAssignableGroups = React.useMemo(() => {
    if (groupFilter === "ALL") return groupsWithPermissions;
    return groupsWithPermissions.filter((g) => g.id === Number(groupFilter));
  }, [groupsWithPermissions, groupFilter]);
  const selectedGroup = React.useMemo(
    () => groupsWithPermissions.find((g) => g.id === selectedGroupId) ?? null,
    [groupsWithPermissions, selectedGroupId],
  );

  const userPermissionModules = React.useMemo(() => {
    const modules = groupPermissionsByModule((permissions ?? []) as PermissionAssignItem[]);
    return {
      modules: filterModulesByApp(modules, appsFilter),
      apps: moduleFilterOptions(modules),
    };
  }, [permissions, appsFilter]);

  const userPermissionsFlat = React.useMemo(
    () => allPermissionsInModules(userPermissionModules.modules),
    [userPermissionModules.modules],
  );
  const groupPermissionsFlat = React.useMemo(
    () => allPermissionsInModules(groupPermissionModules.modules),
    [groupPermissionModules.modules],
  );

  React.useEffect(() => {
    if (!selectedUserId && filteredUsers.length) setSelectedUserId(filteredUsers[0].id);
  }, [filteredUsers, selectedUserId]);
  React.useEffect(() => {
    if (assignType !== "GROUP") return;
    if (groupsWithPermissions.length === 0) {
      setSelectedGroupId(null);
      return;
    }
    if (!selectedGroupId || !groupsWithPermissions.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(groupsWithPermissions[0].id);
    }
  }, [assignType, groupsWithPermissions, selectedGroupId]);

  return (
    <div className="space-y-4">
      {mode === "USER_ASSIGN" ? (
        <div>
          <h1 className="text-4xl font-semibold text-[#065F46]">Apply Permissions</h1>
          <p className="mt-1 text-sm text-black/60">Users Management - Permissions</p>
        </div>
      ) : null}

      {mode === "USER_ASSIGN" ? (
        <Card>
          <CardContent className="grid items-stretch gap-4 pt-4 md:grid-cols-[300px_1fr]">
            <div className="min-h-[520px] rounded-md border border-black/10 bg-white p-3">
              <div className="mb-3 text-lg font-semibold text-black">Search user?</div>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                <Input
                  className="pl-9 text-black placeholder:text-black/45"
                  placeholder="Search user..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
              <div className="space-y-1 rounded-md border border-black/10 p-2">
                {shouldSearchUsers ? filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full rounded-md px-2 py-2 text-left text-sm ${selectedUserId === u.id ? "bg-[#065F46] text-white" : "hover:bg-black/5"}`}
                  >
                    <div className="font-medium">{u.name}</div>
                  </button>
                )) : null}
                {!shouldSearchUsers ? (
                  <div className="px-2 py-3 text-sm text-black/60">Type a name or email to search users.</div>
                ) : null}
                {shouldSearchUsers && filteredUsers.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-black/55">No users found. Try another search.</div>
                ) : null}
              </div>
              <Button
                className="mt-3 w-full bg-[#065F46] text-white hover:bg-[#054e3a]"
                disabled={!selectedUserId || savingUserPermissions || savingUserGroups}
                onClick={async () => {
                  if (!selectedUserId) return;
                  if (assignType === "USER") {
                    const permissionIds = Object.entries(userPermissionMap)
                      .filter(([, enabled]) => enabled)
                      .map(([id]) => Number(id));
                    await saveUserPermissions({ userId: selectedUserId, permissionIds }).unwrap();
                    toast.success("User permissions saved");
                    await refetchPermissions();
                  } else {
                    const groupIds = Object.entries(userGroupMap)
                      .filter(([, enabled]) => enabled)
                      .map(([id]) => Number(id));
                    await saveUserGroups({ userId: selectedUserId, groupIds }).unwrap();
                    toast.success("User groups saved");
                    await refetchGroups();
                  }
                }}
              >
                Save Permissions
              </Button>
            </div>

            <div className="min-h-[520px] rounded-md border border-black/10 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-black">Permission Type</div>
                  <select
                    value={assignType}
                    onChange={(e) => setAssignType(e.target.value as UserAssignType)}
                    className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                  >
                    <option value="USER">User</option>
                    <option value="GROUP">Group</option>
                  </select>
                  {assignType === "USER" ? (
                    <select
                      value={appsFilter}
                      onChange={(e) => setAppsFilter(e.target.value)}
                      className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                    >
                      {userPermissionModules.apps.map((app) => (
                        <option key={app} value={app}>
                          {formatModuleLabel(app)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                    >
                      <option value="ALL">All</option>
                      {groupsWithPermissions.map((g) => (
                        <option key={g.id} value={String(g.id)}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <Button variant="outline" className="text-red-600" onClick={() => router.back()}>
                  Go Back
                </Button>
              </div>

              {assignType === "USER" ? (
                <div className="max-h-[min(62vh,640px)] space-y-4 overflow-y-auto pr-1">
                  {!selectedUserId ? (
                    <div className="rounded-md border border-black/10 bg-white px-4 py-8 text-center text-sm text-black/60">
                      Select a user from the list to assign permissions.
                    </div>
                  ) : permissionsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : permissionsError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      Could not load permissions. Ensure your account has permission to manage users.
                    </div>
                  ) : userPermissionsFlat.length === 0 ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      No permissions found in the system. Run <span className="font-mono">npm run db:seed</span> to create default permissions.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between rounded-md bg-black/[0.03] px-3 py-2 text-sm text-black">
                        <span className="font-medium">Check all of the models</span>
                        <Switch
                          checked={
                            userPermissionsFlat.length > 0 &&
                            userPermissionsFlat.every((p) => Boolean(userPermissionMap[p.id]))
                          }
                          onCheckedChange={(checked) => {
                            setUserPermissionMap((prev) => {
                              const next = { ...prev };
                              userPermissionsFlat.forEach((p) => {
                                next[p.id] = checked;
                              });
                              return next;
                            });
                          }}
                        />
                      </div>
                      {userPermissionModules.modules.map((mod) => (
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
                                  checked={Boolean(userPermissionMap[p.id])}
                                  onCheckedChange={(checked) => {
                                    setUserPermissionMap((prev) => ({ ...prev, [p.id]: checked }));
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-black">Assign Group</div>
                  <div className="space-y-2">
                    {filteredAssignableGroups.map((g) => {
                      const assigned = Boolean(userGroupMap[g.id]);
                      const selected = selectedGroupId === g.id;
                      return (
                        <div
                          key={g.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedGroupId(g.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedGroupId(g.id);
                            }
                          }}
                          className={`w-full rounded-md border px-4 py-3 text-left ${
                            selected ? "border-[#065F46]/30 bg-[#065F46]/10" : "border-black/10 bg-white hover:bg-black/[0.02]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-black">{g.name}</div>
                            <Switch
                              checked={assigned}
                              onCheckedChange={(checked) => {
                                setSelectedGroupId(g.id);
                                setUserGroupMap((prev) => ({ ...prev, [g.id]: checked }));
                              }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-black/70">{g.permissionsCount} permissions</div>
                        </div>
                      );
                    })}
                    {filteredAssignableGroups.length === 0 ? (
                      <div className="rounded-md border border-black/10 bg-white px-3 py-4 text-center text-sm text-black/55">
                        No existing groups with permissions found.
                      </div>
                    ) : null}
                  </div>

                  {selectedGroup ? (
                    <div className="rounded-md border border-black/10 bg-[#065F46]/5 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-black">Selected Group: {selectedGroup.name}</div>
                          <div className="text-xs text-black/65">User will inherit all permissions from this group.</div>
                        </div>
                        {Boolean(userGroupMap[selectedGroup.id]) ? (
                          <Button
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => {
                              setUserGroupMap((prev) => ({ ...prev, [selectedGroup.id]: false }));
                            }}
                          >
                            Remove
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            className="text-[#065F46] hover:bg-[#065F46]/10 hover:text-[#054e3a]"
                            onClick={() => {
                              setUserGroupMap((prev) => ({ ...prev, [selectedGroup.id]: true }));
                            }}
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "GROUP_PERMISSIONS" ? (
        <Card>
          <CardHeader>
            <CardTitle>Set Group Permissions</CardTitle>
            <div className="text-sm text-black/60">Users Management - Permissions - Groups</div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <select
                  value={appsFilter}
                  onChange={(e) => setAppsFilter(e.target.value)}
                  className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/20"
                >
                  {groupPermissionModules.apps.map((app) => (
                    <option key={app} value={app}>
                      {formatModuleLabel(app)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="bg-[#065F46] text-white hover:bg-[#054e3a]"
                  disabled={!selectedGroupId || savingGroupPermissions}
                  onClick={async () => {
                    if (!selectedGroupId) return;
                    const permissionIds = Object.entries(groupPermissionMap)
                      .filter(([, enabled]) => enabled)
                      .map(([id]) => Number(id));
                    await saveGroupPermissions({ groupId: selectedGroupId, permissionIds }).unwrap();
                    toast.success("Group permissions saved");
                    await refetchGroupPermissions();
                  }}
                >
                  Save Permissions
                </Button>
                <Button variant="outline" className="text-red-600" onClick={() => router.push("/admin/groups")}>
                  Go Back
                </Button>
              </div>
            </div>

            {groupPermissionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : groupPermissionsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Could not load group permissions.
              </div>
            ) : groupPermissionsFlat.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No permissions found. Run <span className="font-mono">npm run db:seed</span> first.
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between rounded-md bg-black/[0.03] px-3 py-2 text-sm text-black">
                  <span className="font-medium">Check all of the models</span>
                  <Switch
                    checked={
                      groupPermissionsFlat.length > 0 &&
                      groupPermissionsFlat.every((p) => Boolean(groupPermissionMap[p.id]))
                    }
                    onCheckedChange={(checked) => {
                      setGroupPermissionMap((prev) => {
                        const next = { ...prev };
                        groupPermissionsFlat.forEach((p) => {
                          next[p.id] = checked;
                        });
                        return next;
                      });
                    }}
                  />
                </div>

                <div className="max-h-[min(62vh,640px)] space-y-4 overflow-y-auto">
                  {groupPermissionModules.modules.map((mod) => (
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
                              checked={Boolean(groupPermissionMap[p.id])}
                              onCheckedChange={(checked) => {
                                setGroupPermissionMap((prev) => ({ ...prev, [p.id]: checked }));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

