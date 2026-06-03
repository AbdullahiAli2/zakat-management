import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { DEFAULT_WALLET_CODES, GL } from "./constants";

type DbClient = Prisma.TransactionClient | typeof prisma;

const CHART_ACCOUNTS: Array<{
  code: string;
  name: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
}> = [
  { code: GL.MAIN_CASH, name: "Main Cash Pool", accountType: "ASSET" },
  { code: GL.ZAKAT_CASH, name: "Zakat Cash Pool", accountType: "ASSET" },
  { code: GL.SADAQAH_CASH, name: "Sadaqah Cash Pool", accountType: "ASSET" },
  { code: GL.EMERGENCY_CASH, name: "Emergency Cash Pool", accountType: "ASSET" },
  { code: GL.OPERATIONS_CASH, name: "Operations Cash Pool", accountType: "ASSET" },
  { code: GL.ZAKAT_INCOME, name: "Zakat Income", accountType: "INCOME" },
  { code: GL.SADAQAH_INCOME, name: "Sadaqah Income", accountType: "INCOME" },
  { code: GL.ZAKAT_DIST_EXPENSE, name: "Zakat Distribution Expense", accountType: "EXPENSE" },
  { code: GL.EMERGENCY_DIST_EXPENSE, name: "Emergency Distribution Expense", accountType: "EXPENSE" },
  { code: GL.OPERATIONS_EXPENSE, name: "Operations Expense", accountType: "EXPENSE" },
];

const SYSTEM_WALLETS: Array<{
  code: string;
  name: string;
  walletType: "MAIN" | "ZAKAT" | "SADAQAH" | "EMERGENCY" | "OPERATIONS";
  chartCode: string;
}> = [
  { code: DEFAULT_WALLET_CODES.MAIN, name: "Main Pool", walletType: "MAIN", chartCode: GL.MAIN_CASH },
  { code: DEFAULT_WALLET_CODES.ZAKAT, name: "Zakat Pool", walletType: "ZAKAT", chartCode: GL.ZAKAT_CASH },
  { code: DEFAULT_WALLET_CODES.SADAQAH, name: "Sadaqah Pool", walletType: "SADAQAH", chartCode: GL.SADAQAH_CASH },
  { code: DEFAULT_WALLET_CODES.EMERGENCY, name: "Emergency Pool", walletType: "EMERGENCY", chartCode: GL.EMERGENCY_CASH },
  { code: DEFAULT_WALLET_CODES.OPERATIONS, name: "Operations Pool", walletType: "OPERATIONS", chartCode: GL.OPERATIONS_CASH },
];

/** Idempotent GL + organizational wallet bootstrap required for zakat approval and distributions. */
export async function ensureDefaultAccounting(client: DbClient = prisma) {
  for (const account of CHART_ACCOUNTS) {
    await client.chartOfAccount.upsert({
      where: { code: account.code },
      create: {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        isActive: true,
      },
      update: {
        name: account.name,
        accountType: account.accountType,
        isActive: true,
      },
    });
  }

  for (const wallet of SYSTEM_WALLETS) {
    const chartAccount = await client.chartOfAccount.findUnique({ where: { code: wallet.chartCode } });
    if (!chartAccount) {
      throw new Error(`Missing chart account ${wallet.chartCode} for wallet ${wallet.code}`);
    }

    await client.systemWallet.upsert({
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
}
