import { prisma } from "./db";

const permissionDefs: Array<{ codename: string; name: string }> = [
  { codename: "AUTH_LOGIN", name: "Allow login access" },
  { codename: "AUTH_REGISTER", name: "Allow register access" },
  { codename: "WALLET_MANAGE", name: "Manage donor wallet accounts" },
  { codename: "PROFILE_VIEW", name: "View own profile" },
  { codename: "PROFILE_EDIT", name: "Edit own profile" },
  { codename: "ZAKAT_PAY", name: "Pay zakat" },
  { codename: "ZAKAT_CALCULATE", name: "Calculate zakat" },
  { codename: "ZAKAT_APPROVE", name: "Approve zakat payments" },
  { codename: "DASHBOARD_VIEW", name: "View dashboard" },
  { codename: "TRANSACTIONS_VIEW", name: "View transactions" },
  { codename: "TRANSACTIONS_ADD", name: "Add transactions" },
  { codename: "TRANSACTIONS_EDIT", name: "Edit transactions" },
  { codename: "TRANSACTIONS_DELETE", name: "Delete transactions" },
  { codename: "USERS_VIEW", name: "View users" },
  { codename: "USERS_ADD", name: "Add users" },
  { codename: "USERS_EDIT", name: "Edit users" },
  { codename: "USERS_DELETE", name: "Delete users" },
  { codename: "USERS_RESET_PASSWORD", name: "Reset user password" },
  { codename: "USERS_MANAGE", name: "Manage users" },
  { codename: "PERMISSIONS_MANAGE", name: "Manage permissions" },
  { codename: "GROUPS_VIEW", name: "View groups" },
  { codename: "GROUPS_ADD", name: "Add groups" },
  { codename: "GROUPS_EDIT", name: "Edit groups" },
  { codename: "GROUPS_DELETE", name: "Delete groups" },
  { codename: "NISAB_VIEW", name: "View nisab settings" },
  { codename: "NISAB_EDIT", name: "Edit nisab settings" },
  { codename: "SYSTEM_WALLET_VIEW", name: "View system wallet" },
  { codename: "SYSTEM_WALLET_EDIT", name: "Edit system wallet" },
  { codename: "WALLETS_VIEW", name: "View organizational wallets" },
  { codename: "WALLETS_CREATE", name: "Create organizational wallets" },
  { codename: "WALLETS_SUSPEND", name: "Suspend or activate wallets" },
  { codename: "WALLETS_LEDGER_VIEW", name: "View wallet general ledger" },
  { codename: "JOURNAL_POST", name: "Post manual journal entries" },
  { codename: "DISTRIBUTIONS_VIEW", name: "View distributions" },
  { codename: "DISTRIBUTIONS_ADD", name: "Add distributions" },
  { codename: "DISTRIBUTIONS_EDIT", name: "Edit distributions" },
  { codename: "DISTRIBUTIONS_DELETE", name: "Delete distributions" },
  { codename: "DISTRIBUTIONS_MANAGE", name: "Manage distributions" },
  { codename: "COMMUNITY_DISTRIBUTIONS_VIEW", name: "View community distributions" },
  { codename: "COMMUNITY_DISTRIBUTIONS_CREATE", name: "Create community distributions" },
  { codename: "COMMUNITY_DISTRIBUTIONS_APPROVE", name: "Approve community distributions" },
  { codename: "COMMUNITY_DISTRIBUTIONS_COMPLETE", name: "Complete community distributions" },
  { codename: "COMMUNITY_DISTRIBUTIONS_DELETE", name: "Delete community distributions" },
  { codename: "BENEFICIARIES_VIEW", name: "View beneficiaries" },
  { codename: "BENEFICIARIES_VERIFY", name: "Verify beneficiaries" },
  { codename: "RECEIPTS_VIEW", name: "View receipts" },
  { codename: "REPORTS_VIEW", name: "View reports" },
  { codename: "REPORTS_GENERATE", name: "Generate reports" },
  { codename: "BACKUPS_VIEW", name: "View backups" },
  { codename: "BACKUPS_CREATE", name: "Create backups" },
  { codename: "AUDIT_VIEW", name: "View audit logs" },
];

export async function ensureDefaultRBAC() {
  await Promise.all(
    permissionDefs.map((p) =>
      prisma.permission.upsert({
        where: { codename: p.codename },
        create: { codename: p.codename, name: p.name },
        update: { name: p.name },
      }),
    ),
  );
}

export { permissionDefs };
