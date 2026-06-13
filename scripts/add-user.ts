/**
 * Add (or update) a user from the CLI.
 *   pnpm exec tsx scripts/add-user.ts "<name>" <email> [password]
 * Password defaults to "password123".
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const [, , name, email, password = "password123"] = process.argv;
  if (!name || !email) {
    console.error('Usage: tsx scripts/add-user.ts "<name>" <email> [password]');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: { name },
    create: { name, email: email.toLowerCase().trim(), passwordHash },
    select: { id: true, name: true, email: true },
  });

  console.log("✅ User ready:");
  console.log(`   name:     ${user.name}`);
  console.log(`   email:    ${user.email}`);
  console.log(`   password: ${password}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Failed:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
