import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { isDonorRole, isSuperuserRole } from "./roles";

export type PermissionCode =
  | "AUTH_LOGIN"
  | "AUTH_REGISTER"
  | "WALLET_MANAGE"
  | "PROFILE_VIEW"
  | "PROFILE_EDIT"
  | "ZAKAT_PAY"
  | "ZAKAT_CALCULATE"
  | "ZAKAT_APPROVE"
  | "DASHBOARD_VIEW"
  | "TRANSACTIONS_VIEW"
  | "TRANSACTIONS_ADD"
  | "TRANSACTIONS_EDIT"
  | "TRANSACTIONS_DELETE"
  | "USERS_VIEW"
  | "USERS_ADD"
  | "USERS_EDIT"
  | "USERS_DELETE"
  | "USERS_RESET_PASSWORD"
  | "USERS_MANAGE"
  | "PERMISSIONS_MANAGE"
  | "GROUPS_VIEW"
  | "GROUPS_ADD"
  | "GROUPS_EDIT"
  | "GROUPS_DELETE"
  | "NISAB_VIEW"
  | "NISAB_EDIT"
  | "SYSTEM_WALLET_VIEW"
  | "SYSTEM_WALLET_EDIT"
  | "WALLETS_VIEW"
  | "WALLETS_CREATE"
  | "WALLETS_SUSPEND"
  | "WALLETS_LEDGER_VIEW"
  | "JOURNAL_POST"
  | "DISTRIBUTIONS_VIEW"
  | "DISTRIBUTIONS_ADD"
  | "DISTRIBUTIONS_EDIT"
  | "DISTRIBUTIONS_DELETE"
  | "DISTRIBUTIONS_MANAGE"
  | "COMMUNITY_DISTRIBUTIONS_VIEW"
  | "COMMUNITY_DISTRIBUTIONS_CREATE"
  | "COMMUNITY_DISTRIBUTIONS_APPROVE"
  | "COMMUNITY_DISTRIBUTIONS_COMPLETE"
  | "COMMUNITY_DISTRIBUTIONS_DELETE"
  | "BENEFICIARIES_VIEW"
  | "BENEFICIARIES_VERIFY"
  | "RECEIPTS_VIEW"
  | "REPORTS_VIEW"
  | "REPORTS_GENERATE"
  | "BACKUPS_VIEW"
  | "BACKUPS_CREATE"
  | "AUDIT_VIEW";

const DONOR_DEFAULT_PERMISSIONS: PermissionCode[] = [
  "AUTH_LOGIN",
  "AUTH_REGISTER",
  "WALLET_MANAGE",
  "PROFILE_VIEW",
  "PROFILE_EDIT",
  "ZAKAT_PAY",
  "ZAKAT_CALCULATE",
  "DASHBOARD_VIEW",
  "TRANSACTIONS_VIEW",
];

export async function userHasPermission(user: SessionUser, code: PermissionCode) {
  const users = await prisma.$queryRawUnsafe<Array<{ id: number; is_active: boolean; role: string }>>(
    "SELECT id, is_active, role FROM users WHERE id = ? LIMIT 1",
    user.userId,
  );
  const dbUser = users[0];
  if (!dbUser) return false;
  if (!dbUser.is_active) return false;
  if (isSuperuserRole(dbUser.role as SessionUser["role"])) return true;
  if (isDonorRole(dbUser.role as SessionUser["role"]) && DONOR_DEFAULT_PERMISSIONS.includes(code)) return true;

  const permissionRows = await prisma.$queryRawUnsafe<Array<{ ok: number }>>(
    `SELECT 1 AS ok
     FROM permissions p
     LEFT JOIN user_permission up ON up.permission_id = p.id AND up.user_id = ?
     LEFT JOIN group_permission gp ON gp.permission_id = p.id
     LEFT JOIN user_group ug ON ug.group_id = gp.group_id AND ug.user_id = ?
     WHERE p.codename = ? AND (up.id IS NOT NULL OR ug.id IS NOT NULL)
     LIMIT 1`,
    user.userId,
    user.userId,
    code,
  );

  return Boolean(permissionRows[0]?.ok);
}

export async function requirePermission(user: SessionUser, code: PermissionCode) {
  const users = await prisma.$queryRawUnsafe<Array<{ id: number; is_active: boolean; role: string }>>(
    "SELECT id, is_active, role FROM users WHERE id = ? LIMIT 1",
    user.userId,
  );
  const dbUser = users[0];
  if (!dbUser) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!dbUser.is_active) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  if (isSuperuserRole(dbUser.role as SessionUser["role"])) return;

  const ok = await userHasPermission(user, code);
  if (!ok) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}
