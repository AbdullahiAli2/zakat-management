import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const repairs = [
  {
    name: "users.avatar_url",
    sql: "ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(191) NULL",
    check: "SHOW COLUMNS FROM `users` LIKE 'avatar_url'",
  },
];

async function main() {
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
