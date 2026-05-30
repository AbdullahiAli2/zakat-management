/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const prisma = new PrismaClient();
  const email = "superuser@gmail.com";
  const password = "Admin@20";
  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName: "System",
      lastName: "Superuser",
      password: hashed,
      isSuperuser: true,
      isAdmin: false,
      isDonor: false,
      isActive: true,
    },
    create: {
      firstName: "System",
      lastName: "Superuser",
      email,
      password: hashed,
      isSuperuser: true,
      isAdmin: false,
      isDonor: false,
      isActive: true,
    },
  });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, name: "Main Wallet" },
  });

  if (!account) {
    await prisma.account.create({
      data: { userId: user.id, name: "Main Wallet", balance: 0, status: "ACTIVE" },
    });
  }

  console.log("SUPERUSER_CREATED", user.id, user.email);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
