import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureAccounting() {
  const chartAccounts = [
    { code: "1000", name: "Main Cash Pool", accountType: "ASSET" },
    { code: "1010", name: "Zakat Cash Pool", accountType: "ASSET" },
    { code: "1020", name: "Sadaqah Cash Pool", accountType: "ASSET" },
    { code: "1030", name: "Emergency Cash Pool", accountType: "ASSET" },
    { code: "1040", name: "Operations Cash Pool", accountType: "ASSET" },
    { code: "4000", name: "Zakat Income", accountType: "INCOME" },
    { code: "4100", name: "Sadaqah Income", accountType: "INCOME" },
    { code: "5000", name: "Zakat Distribution Expense", accountType: "EXPENSE" },
    { code: "5100", name: "Emergency Distribution Expense", accountType: "EXPENSE" },
    { code: "5200", name: "Operations Expense", accountType: "EXPENSE" },
  ];

  for (const account of chartAccounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      create: { code: account.code, name: account.name, accountType: account.accountType, isActive: true },
      update: { name: account.name, accountType: account.accountType, isActive: true },
    });
  }

  const systemWallets = [
    { code: "WAL-MAIN", name: "Main Pool", walletType: "MAIN", chartCode: "1000" },
    { code: "WAL-ZAKAT", name: "Zakat Pool", walletType: "ZAKAT", chartCode: "1010" },
    { code: "WAL-SADAQAH", name: "Sadaqah Pool", walletType: "SADAQAH", chartCode: "1020" },
    { code: "WAL-EMERGENCY", name: "Emergency Pool", walletType: "EMERGENCY", chartCode: "1030" },
    { code: "WAL-OPS", name: "Operations Pool", walletType: "OPERATIONS", chartCode: "1040" },
  ];

  for (const wallet of systemWallets) {
    const chartAccount = await prisma.chartOfAccount.findUnique({ where: { code: wallet.chartCode } });
    if (!chartAccount) throw new Error(`Missing chart account ${wallet.chartCode}`);
    await prisma.systemWallet.upsert({
      where: { code: wallet.code },
      create: {
        code: wallet.code,
        name: wallet.name,
        walletType: wallet.walletType,
        chartAccountId: chartAccount.id,
        status: "ACTIVE",
      },
      update: {
        name: wallet.name,
        walletType: wallet.walletType,
        chartAccountId: chartAccount.id,
        status: "ACTIVE",
      },
    });
  }

  console.log("[OK] Chart of accounts and system wallets ready");
}

const repairs = [
  {
    name: "users.avatar_url",
    sql: "ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(191) NULL",
    check: "SHOW COLUMNS FROM `users` LIKE 'avatar_url'",
  },
];

async function main() {
  try {
    await ensureAccounting();
  } catch (e) {
    console.error("[FAIL] Accounting bootstrap:", e?.message ?? e);
    process.exitCode = 1;
  }

  for (const repair of repairs) {
    const existing = await prisma.$queryRawUnsafe<Array<{ Field: string }>>(repair.check);
    if (existing.length > 0) {
      console.log(`[OK] ${repair.name} already exists`);
      continue;
    }
    try {
      await prisma.$executeRawUnsafe(repair.sql);
      console.log(`[FIXED] Added ${repair.name}`);
    } catch (e) {
      console.error(`[FAIL] Could not add ${repair.name}:`, e?.message ?? e);
      process.exitCode = 1;
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
