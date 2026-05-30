import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  try {
    const passwordHash = await hash("Admin@20", 12);
    const email = `test${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        firstName: "Test",
        lastName: "User",
        email,
        password: passwordHash,
        phone: "617465218",
        age: 24,
        gender: "MALE",
        country: "Somalia",
        city: "Mogadishu",
        address: "Howl wdg",
        role: "DONOR",
        isActive: true,
      },
    });
    console.log("OK user", user.id);
    await prisma.user.delete({ where: { id: user.id } });
  } catch (e) {
    console.error("FAIL", e?.message);
    console.error(e);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
