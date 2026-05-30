export const USER_ROLES = ["SUPERUSER", "ADMIN", "DONOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isSuperuserRole(role: UserRole) {
  return role === "SUPERUSER";
}

export function isAdminRole(role: UserRole) {
  return role === "SUPERUSER" || role === "ADMIN";
}

export function isDonorRole(role: UserRole) {
  return role === "DONOR";
}

export function roleFromLegacyFlags(input: { is_superuser?: boolean | number; is_admin?: boolean | number; is_donor?: boolean | number }) {
  if (input.is_superuser) return "SUPERUSER" as const;
  if (input.is_admin) return "ADMIN" as const;
  return "DONOR" as const;
}
