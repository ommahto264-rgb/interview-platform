import { prisma } from "./client";

async function main() {
  const userCount = await prisma.user.count();
  const organizationCount = await prisma.organization.count();
  const membershipCount = await prisma.organizationMembership.count();

  console.log("Connected to Neon successfully.");

  console.table({
    users: userCount,
    organizations: organizationCount,
    organization_memberships: membershipCount,
  });
}

main()
  .catch((error) => {
    console.error("Database check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });