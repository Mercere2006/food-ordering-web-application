import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to the database.");
  }

  const poolUrl = new URL(databaseUrl);
  poolUrl.searchParams.set("connectionLimit", "5");
  poolUrl.searchParams.set("minimumIdle", "0");

  return new PrismaClient({ adapter: new PrismaMariaDb(poolUrl.toString()) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
