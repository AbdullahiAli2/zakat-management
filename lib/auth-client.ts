"use client";

import { store } from "@/store/store";
import { api } from "@/store/api";

const AUTH_STORAGE_PREFIXES = ["zakat_", "auth_", "rtk-query"] as const;

/** Wipe RTK Query cache so the next user never sees the previous session. */
export function resetAuthCache() {
  store.dispatch(api.util.resetApiState());
}

/** Clear any client persistence that could leak session context. */
export function clearAuthStorage() {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (AUTH_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/** Fetch current user + permissions into a clean cache (call after login). */
export async function prefetchAuthSession() {
  const meQuery = store.dispatch(api.endpoints.getMe.initiate(undefined, { subscribe: false, forceRefetch: true }));
  const permQuery = store.dispatch(api.endpoints.getMyPermissions.initiate(undefined, { subscribe: false, forceRefetch: true }));

  try {
    await Promise.all([meQuery.unwrap(), permQuery.unwrap()]);
  } finally {
    meQuery.unsubscribe();
    permQuery.unsubscribe();
  }
}

export async function completeLoginSession() {
  resetAuthCache();
  clearAuthStorage();
  await prefetchAuthSession();
}

export async function logoutClientSession() {
  resetAuthCache();
  clearAuthStorage();

  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // cookie clear is best-effort; client state is already wiped
  }
}

export function homePathForRole(role?: string | null) {
  if (role === "ADMIN" || role === "SUPERUSER") return "/admin";
  return "/donor";
}

export function isAdminRole(role?: string | null) {
  return role === "ADMIN" || role === "SUPERUSER";
}
