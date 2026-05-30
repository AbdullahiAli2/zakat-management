"use client";

import { useGetMeQuery, useGetMyPermissionsQuery } from "@/store/api";
import { isAdminRole } from "@/lib/auth-client";

export function useAuth() {
  const {
    data: me,
    isLoading: meLoading,
    isFetching: meFetching,
    error: meError,
    refetch: refetchMe,
  } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const {
    data: permissions,
    isLoading: permLoading,
    isFetching: permFetching,
    refetch: refetchPermissions,
  } = useGetMyPermissionsQuery(undefined, {
    skip: !me,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const isBootstrapping = meLoading || permLoading || ((meFetching || permFetching) && !me);

  return {
    me,
    permissions,
    role: me?.role ?? null,
    isAdmin: isAdminRole(me?.role),
    isBootstrapping,
    isAuthenticated: Boolean(me && !meError),
    refetch: async () => {
      await Promise.all([refetchMe(), refetchPermissions()]);
    },
  };
}
