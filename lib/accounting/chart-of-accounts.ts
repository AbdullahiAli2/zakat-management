import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import type { AccountType } from "./constants";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getAccountByCode(client: DbClient, code: string) {
  const rows = await client.$queryRawUnsafe<
    Array<{ id: number; code: string; name: string; account_type: AccountType; is_active: boolean | number }>
  >("SELECT id, code, name, account_type, is_active FROM chart_of_accounts WHERE code = ? LIMIT 1", code);
  const row = rows[0];
  if (!row || !row.is_active) return null;
  return row;
}

export async function listChartOfAccounts(client: DbClient = prisma) {
  return client.$queryRawUnsafe<
    Array<{ id: number; code: string; name: string; account_type: AccountType; is_active: boolean | number }>
  >("SELECT id, code, name, account_type, is_active FROM chart_of_accounts WHERE is_active = true ORDER BY code ASC");
}

export async function getAccountBalance(client: DbClient, accountId: number) {
  const rows = await client.$queryRawUnsafe<Array<{ balance: number | string | null }>>(
    `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS balance
     FROM journal_entry_lines jel
     INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE jel.account_id = ? AND je.status = 'POSTED'`,
    accountId,
  );
  return Number(rows[0]?.balance ?? 0);
}
