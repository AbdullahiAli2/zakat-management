import { Prisma } from "@prisma/client";
import { prisma } from "./db";

const FINANCE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS finance_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  total_collected DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_distributed DECIMAL(18,2) NOT NULL DEFAULT 0,
  balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export async function ensureFinanceAccount() {
  await prisma.$executeRawUnsafe(FINANCE_TABLE_SQL);
  await prisma.$executeRaw`
    INSERT INTO finance_accounts (name, total_collected, total_distributed, balance)
    VALUES ('main', 0, 0, 0)
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `;
}

export async function addCollectedWithTx(tx: Prisma.TransactionClient, amount: Prisma.Decimal) {
  await tx.$executeRawUnsafe(FINANCE_TABLE_SQL);
  await tx.$executeRaw`
    INSERT INTO finance_accounts (name, total_collected, total_distributed, balance)
    VALUES ('main', ${amount}, 0, ${amount})
    ON DUPLICATE KEY UPDATE
      total_collected = total_collected + ${amount},
      balance = balance + ${amount}
  `;
}

export async function getFinanceSnapshot() {
  await ensureFinanceAccount();
  const rows = await prisma.$queryRaw<
    Array<{
      totalCollected: Prisma.Decimal;
      totalDistributed: Prisma.Decimal;
      balance: Prisma.Decimal;
    }>
  >`SELECT total_collected AS totalCollected, total_distributed AS totalDistributed, balance FROM finance_accounts WHERE name = 'main' LIMIT 1`;

  const row = rows[0];
  return {
    totalCollected: row?.totalCollected?.toString?.() ?? "0",
    totalDistributed: row?.totalDistributed?.toString?.() ?? "0",
    balance: row?.balance?.toString?.() ?? "0",
  };
}

