import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function seedRBAC() {
  const permissionDefs = [
    { codename: "AUTH_LOGIN", name: "Allow login access" },
    { codename: "AUTH_REGISTER", name: "Allow register access" },
    { codename: "WALLET_MANAGE", name: "Manage donor wallet accounts" },
    { codename: "PROFILE_VIEW", name: "View own profile" },
    { codename: "PROFILE_EDIT", name: "Edit own profile" },
    { codename: "ZAKAT_PAY", name: "Pay zakat" },
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
    { codename: "RECEIPTS_VIEW", name: "View receipts" },
    { codename: "REPORTS_VIEW", name: "View reports" },
    { codename: "REPORTS_GENERATE", name: "Generate reports" },
    { codename: "AUDIT_VIEW", name: "View audit logs" },
  ];

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

async function seedNisab() {
  const existing = await prisma.nisabSetting.findFirst();
  if (existing) return;

  const defaultNisab = process.env.NISAB_VALUE ?? "1000";
  const goldPricePerGram = process.env.GOLD_PRICE_PER_GRAM ?? "70";

  await prisma.nisabSetting.create({
    data: {
      goldPricePerGram,
      nisabValue: defaultNisab,
    },
  });
}

function missingBootstrapVars(role: string, keys: string[]) {
  const missing = keys.filter((k) => !process.env[k]?.trim());
  if (missing.length === 0) return null;
  console.warn(
    `[seed] Skipping ${role}: set ${missing.join(", ")} in .env (see .env.example).`,
  );
  return missing;
}

async function seedSuperuser() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    missingBootstrapVars("SUPERUSER", [
      "BOOTSTRAP_ADMIN_NAME",
      "BOOTSTRAP_ADMIN_EMAIL",
      "BOOTSTRAP_ADMIN_PASSWORD",
    ]);
    throw new Error(
      "Missing BOOTSTRAP_ADMIN_* in .env — copy them from .env.example, then run: npm run setup",
    );
  }

  const passwordHash = await hash(password, 12);
  const names = name.trim().split(/\s+/);
  const firstName = names[0] ?? "Super";
  const lastName = names.slice(1).join(" ") || "Admin";

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      create: {
        firstName,
        lastName,
        email,
        password: passwordHash,
        isActive: true,
        role: "SUPERUSER",
      },
      update: {
        firstName,
        lastName,
        password: passwordHash,
        isActive: true,
        role: "SUPERUSER",
      },
    });

    const account = await tx.account.findFirst({ where: { userId: user.id, name: "Main Wallet" } });
    if (!account) {
      await tx.account.create({
        data: {
          userId: user.id,
          name: "Main Wallet",
          balance: 0,
          status: "ACTIVE",
        },
      });
    }
  });

  console.log(`[seed] Superuser ready: ${email}`);
}

async function main() {
  await seedRBAC();
  console.log("[seed] Permissions upserted.");
  await seedNisab();
  console.log("[seed] Nisab settings ready.");
  await seedSuperuser();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
