import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export { prisma };

/** MySQL LAST_INSERT_ID() is BIGINT — Prisma returns bigint; coerce before JSON responses. */
export async function getLastInsertId(
  client: Pick<PrismaClient, "$queryRawUnsafe"> = prisma,
): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ id: bigint | number }>>(
    "SELECT LAST_INSERT_ID() AS id",
  );
  return Number(rows[0]?.id ?? 0);
}

