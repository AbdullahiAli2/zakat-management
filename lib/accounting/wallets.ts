import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import type { WalletType, WalletStatus } from "./constants";
import { DEFAULT_WALLET_CODES } from "./constants";
import { getAccountBalance } from "./chart-of-accounts";

export type DbClient = Prisma.TransactionClient | typeof prisma;

export type WalletRow = {
  id: number;
  code: string;
  name: string;
  wallet_type: WalletType;
  chart_account_id: number;
  status: WalletStatus;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
};

export async function getWalletById(walletId: number, client: DbClient = prisma) {
  const rows = await client.$queryRawUnsafe<WalletRow[]>(
    `SELECT id, code, name, wallet_type, chart_account_id, status, created_by, created_at, updated_at
     FROM system_wallets WHERE id = ? LIMIT 1`,
    walletId,
  );
  return rows[0] ?? null;
}

export async function getWalletByCode(code: string, client: DbClient = prisma) {
  const rows = await client.$queryRawUnsafe<WalletRow[]>(
    `SELECT id, code, name, wallet_type, chart_account_id, status, created_by, created_at, updated_at
     FROM system_wallets WHERE code = ? LIMIT 1`,
    code,
  );
  return rows[0] ?? null;
}

export async function getWalletByType(walletType: WalletType, client: DbClient = prisma) {
  const rows = await client.$queryRawUnsafe<WalletRow[]>(
    `SELECT id, code, name, wallet_type, chart_account_id, status, created_by, created_at, updated_at
     FROM system_wallets WHERE wallet_type = ? AND status = 'ACTIVE' ORDER BY id ASC LIMIT 1`,
    walletType,
  );
  return rows[0] ?? null;
}

/** Ledger balance: SUM(debit - credit) for POSTED lines on the wallet's chart account */
export async function getWalletBalance(walletId: number, client: DbClient = prisma) {
  const wallet = await getWalletById(walletId, client);
  if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });
  const balance = await getAccountBalance(client, wallet.chart_account_id);
  return Math.max(0, balance);
}

export async function getZakatPoolBalance(client: DbClient = prisma) {
  const wallet = await getWalletByCode(DEFAULT_WALLET_CODES.ZAKAT, client);
  if (!wallet) return 0;
  return getWalletBalance(wallet.id, client);
}

export async function listWallets(client: DbClient = prisma, filters?: { walletType?: WalletType; status?: WalletStatus }) {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (filters?.walletType) {
    where.push("wallet_type = ?");
    args.push(filters.walletType);
  }
  if (filters?.status) {
    where.push("status = ?");
    args.push(filters.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return client.$queryRawUnsafe<WalletRow[]>(
    `SELECT id, code, name, wallet_type, chart_account_id, status, created_by, created_at, updated_at
     FROM system_wallets ${whereSql}
     ORDER BY wallet_type ASC, code ASC`,
    ...args,
  );
}

export async function createWallet(
  client: DbClient = prisma,
  input: {
    code: string;
    name: string;
    walletType: WalletType;
    chartAccountId: number;
    createdBy?: number;
  },
) {
  const dup = await getWalletByCode(input.code, client);
  if (dup) throw Object.assign(new Error("Wallet code already exists"), { status: 400 });

  await client.$executeRawUnsafe(
    `INSERT INTO system_wallets (code, name, wallet_type, chart_account_id, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?, NOW(), NOW())`,
    input.code,
    input.name,
    input.walletType,
    input.chartAccountId,
    input.createdBy ?? null,
  );

  const rows = await client.$queryRawUnsafe<Array<{ id: number }>>("SELECT LAST_INSERT_ID() AS id");
  const id = rows[0]?.id;
  if (!id) throw Object.assign(new Error("Failed to create wallet"), { status: 500 });
  return getWalletById(id, client);
}

export async function suspendWallet(walletId: number, client: DbClient = prisma) {
  const wallet = await getWalletById(walletId, client);
  if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });
  if (wallet.status === "SUSPENDED") return wallet;
  await client.$executeRawUnsafe("UPDATE system_wallets SET status = 'SUSPENDED', updated_at = NOW() WHERE id = ?", walletId);
  return getWalletById(walletId, client);
}

export async function activateWallet(walletId: number, client: DbClient = prisma) {
  await client.$executeRawUnsafe("UPDATE system_wallets SET status = 'ACTIVE', updated_at = NOW() WHERE id = ?", walletId);
  return getWalletById(walletId, client);
}

export type LedgerLine = {
  id: number;
  journal_entry_id: number;
  entry_number: string;
  entry_date: Date;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  line_description: string | null;
  running_balance: number;
};

export async function getWalletLedger(walletId: number, opts?: { page?: number; pageSize?: number }, client: DbClient = prisma) {
  const wallet = await getWalletById(walletId, client);
  if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const countRows = await client.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `SELECT COUNT(*) AS total
     FROM journal_entry_lines jel
     INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE jel.account_id = ? AND je.status = 'POSTED'`,
    wallet.chart_account_id,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await client.$queryRawUnsafe<
    Array<{
      id: number;
      journal_entry_id: number;
      entry_number: string;
      entry_date: Date;
      account_code: string;
      account_name: string;
      debit: number | string;
      credit: number | string;
      line_description: string | null;
    }>
  >(
    `SELECT jel.id, jel.journal_entry_id, je.entry_number, je.entry_date,
            coa.code AS account_code, coa.name AS account_name,
            jel.debit, jel.credit, jel.line_description
     FROM journal_entry_lines jel
     INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
     INNER JOIN chart_of_accounts coa ON coa.id = jel.account_id
     WHERE jel.account_id = ? AND je.status = 'POSTED'
     ORDER BY je.entry_date ASC, jel.id ASC
     LIMIT ? OFFSET ?`,
    wallet.chart_account_id,
    pageSize,
    offset,
  );

  let running = 0;
  const items: LedgerLine[] = rows.map((r) => {
    running += Number(r.debit) - Number(r.credit);
    return {
      id: r.id,
      journal_entry_id: r.journal_entry_id,
      entry_number: r.entry_number,
      entry_date: r.entry_date,
      account_code: r.account_code,
      account_name: r.account_name,
      debit: Number(r.debit),
      credit: Number(r.credit),
      line_description: r.line_description,
      running_balance: running,
    };
  });

  return { wallet, page, pageSize, total, items, balance: await getWalletBalance(walletId, client) };
}

export async function getWalletTransactionHistory(walletId: number, opts?: { page?: number; pageSize?: number }, client: DbClient = prisma) {
  const wallet = await getWalletById(walletId, client);
  if (!wallet) throw Object.assign(new Error("Wallet not found"), { status: 404 });

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const countRows = await client.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `SELECT COUNT(DISTINCT t.id) AS total
     FROM transactions t
     INNER JOIN journal_entries je ON je.id = t.journal_entry_id
     INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.wallet_id = ?
     WHERE je.status = 'POSTED'`,
    walletId,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const items = await client.$queryRawUnsafe<
    Array<{
      id: number;
      type: string;
      amount: number | string;
      status: string;
      transaction_code: string | null;
      reference: string | null;
      description: string | null;
      journal_entry_id: number | null;
      entry_number: string | null;
      created_at: Date;
    }>
  >(
    `SELECT DISTINCT t.id, t.type, t.amount, t.status, t.transaction_code, t.reference, t.description,
            t.journal_entry_id, je.entry_number, t.created_at
     FROM transactions t
     INNER JOIN journal_entries je ON je.id = t.journal_entry_id
     INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.wallet_id = ?
     WHERE je.status = 'POSTED'
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    walletId,
    pageSize,
    offset,
  );

  return {
    wallet,
    page,
    pageSize,
    total,
    items: items.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      status: t.status,
      transactionCode: t.transaction_code,
      reference: t.reference,
      description: t.description,
      journalEntryId: t.journal_entry_id,
      entryNumber: t.entry_number,
      createdAt: t.created_at,
    })),
  };
}

export function mapWallet(row: WalletRow, balance: number) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    walletType: row.wallet_type,
    chartAccountId: row.chart_account_id,
    status: row.status,
    balance,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
