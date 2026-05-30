import { prisma } from "./db";

async function getCurrentNisab() {
  const rows = await prisma.$queryRawUnsafe<Array<{ nisab_value: number | string }>>(
    "SELECT nisab_value FROM nisab_settings ORDER BY id DESC LIMIT 1",
  );
  const nisab = rows[0]?.nisab_value;
  if (nisab == null) throw Object.assign(new Error("Nisab setting is not configured"), { status: 400 });
  return Number(nisab);
}

export type CreateZakatCalculationInput = {
  userId: number;
  totalAssets: number;
  liabilities?: number;
  zakatYear?: number;
};

export async function createZakatCalculation(input: CreateZakatCalculationInput) {
  const totalAssets = Math.max(0, input.totalAssets);
  const liabilities = Math.max(0, input.liabilities ?? 0);
  const netAssets = Math.max(0, totalAssets - liabilities);
  const nisabValue = await getCurrentNisab();
  const zakatDue = netAssets >= nisabValue ? Number((netAssets * 0.025).toFixed(2)) : 0;
  const zakatYear = input.zakatYear ?? new Date().getFullYear();

  await prisma.$executeRawUnsafe(
    `INSERT INTO zakat_calculations (user_id, total_assets, liabilities, net_assets, nisab_value, zakat_due, zakat_year, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    input.userId,
    totalAssets,
    liabilities,
    netAssets,
    nisabValue,
    zakatDue,
    zakatYear,
  );

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      user_id: number;
      total_assets: number | string;
      liabilities: number | string;
      net_assets: number | string;
      nisab_value: number | string;
      zakat_due: number | string;
      zakat_year: number | null;
      created_at: Date;
    }>
  >("SELECT * FROM zakat_calculations WHERE id = LAST_INSERT_ID() LIMIT 1");

  const row = rows[0];
  if (!row) throw Object.assign(new Error("Failed to create zakat calculation"), { status: 500 });

  return {
    id: row.id,
    userId: row.user_id,
    totalAssets: Number(row.total_assets),
    liabilities: Number(row.liabilities),
    netAssets: Number(row.net_assets),
    nisabValue: Number(row.nisab_value),
    zakatDue: Number(row.zakat_due),
    zakatYear: row.zakat_year,
    createdAt: row.created_at,
  };
}

export async function getLatestCalculationForUser(userId: number, zakatYear?: number) {
  const year = zakatYear ?? new Date().getFullYear();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      user_id: number;
      total_assets: number | string;
      liabilities: number | string;
      net_assets: number | string;
      nisab_value: number | string;
      zakat_due: number | string;
      zakat_year: number | null;
      created_at: Date;
    }>
  >(
    `SELECT * FROM zakat_calculations
     WHERE user_id = ? AND zakat_year = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    userId,
    year,
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    totalAssets: Number(row.total_assets),
    liabilities: Number(row.liabilities),
    netAssets: Number(row.net_assets),
    nisabValue: Number(row.nisab_value),
    zakatDue: Number(row.zakat_due),
    zakatYear: row.zakat_year,
    createdAt: row.created_at,
  };
}
