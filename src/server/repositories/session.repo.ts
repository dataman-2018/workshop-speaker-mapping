import { prisma } from "@/lib/db/client";

export const sessionRepo = {
  listByProject(projectId: string) {
    return prisma.session.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { participants: true } } },
    });
  },

  get(id: string) {
    return prisma.session.findUnique({
      where: { id },
      include: {
        participants: { orderBy: { label: "asc" } },
        project: true,
      },
    });
  },

  create(data: { name: string; projectId: string }) {
    return prisma.session.create({ data });
  },

  update(id: string, data: { name?: string }) {
    return prisma.session.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.session.delete({ where: { id } });
  },
};
