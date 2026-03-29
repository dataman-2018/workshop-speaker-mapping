import { prisma } from "@/lib/db/client";

export const projectRepo = {
  list(userId?: string) {
    return prisma.project.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
  },

  get(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: { sessions: { orderBy: { createdAt: "desc" } } },
    });
  },

  create(data: { name: string; description?: string; userId: string }) {
    return prisma.project.create({ data });
  },

  update(id: string, data: { name?: string; description?: string }) {
    return prisma.project.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.project.delete({ where: { id } });
  },
};
