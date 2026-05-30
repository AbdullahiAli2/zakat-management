/**
 * @deprecated Use lib/accounting/wallets.ts — balances are ledger-derived, not cached.
 * Backward-compatible helpers for legacy imports.
 */
import type { Prisma } from "@prisma/client";
import { getZakatPoolBalance, getWalletByCode, getWalletBalance, mapWallet } from "./accounting/wallets";
import { DEFAULT_WALLET_CODES } from "./accounting/constants";
import { prisma } from "./db";

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Returns Zakat wallet ledger balance (replaces static system_wallet recompute). */
export async function recomputeSystemWallet(tx?: DbClient) {
  const client = tx ?? prisma;
  return getZakatPoolBalance(client);
}

export async function getPrimarySystemWalletSummary(tx?: DbClient) {
  const client = tx ?? prisma;
  const wallet = await getWalletByCode(DEFAULT_WALLET_CODES.ZAKAT, client);
  if (!wallet) {
    return { id: null, balance: 0, updatedAt: null, code: DEFAULT_WALLET_CODES.ZAKAT };
  }
  const balance = await getWalletBalance(wallet.id, client);
  return {
    id: wallet.id,
    code: wallet.code,
    balance,
    updatedAt: wallet.updated_at,
  };
}

export { getZakatPoolBalance, getWalletBalance, mapWallet };
