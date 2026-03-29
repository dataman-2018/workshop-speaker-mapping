import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7.x: datasource URL is configured in prisma.config.ts
// @ts-expect-error — Prisma 7 requires adapter or accelerateUrl, but runtime resolves from config
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
