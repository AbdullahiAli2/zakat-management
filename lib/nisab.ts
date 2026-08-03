import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type CurrentNisab = {
  id: number;
  goldPricePerGram: Prisma.Decimal;
  nisabValue: Prisma.Decimal;
  updatedAt: Date;
};

/** Single source of truth for the live Nisab threshold (gold price × 85g). */
export async function getCurrentNisab(client: DbClient = prisma): Promise<CurrentNisab | null> {
  const rows = await client.$queryRawUnsafe<
    Array<{
      id: number;
      gold_price_per_gram: number | string;
      nisab_value: number | string;
      updated_at: Date;
    }>
  >(
    `SELECT id, gold_price_per_gram, nisab_value, updated_at
     FROM nisab_settings
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    goldPricePerGram: new Prisma.Decimal(row.gold_price_per_gram),
    nisabValue: new Prisma.Decimal(row.nisab_value),
    updatedAt: row.updated_at,
  };
}
