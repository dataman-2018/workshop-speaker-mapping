import { prisma } from "@/lib/db/client";

/** Convert 0-based index to A, B, C, ... Z, AA, AB, ... */
function indexToLabel(index: number): string {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export const participantRepo = {
  listBySession(sessionId: string) {
    return prisma.participant.findMany({
      where: { sessionId },
      orderBy: { label: "asc" },
    });
  },

  get(id: string) {
    return prisma.participant.findUnique({
      where: { id },
      include: { session: true },
    });
  },

  async create(data: { sessionId: string; displayName?: string }) {
    // Count existing participants to auto-assign label
    const count = await prisma.participant.count({
      where: { sessionId: data.sessionId },
    });
    const label = indexToLabel(count);

    return prisma.participant.create({
      data: {
        sessionId: data.sessionId,
        label,
        displayName: data.displayName ?? null,
      },
    });
  },

  update(id: string, data: { displayName?: string }) {
    return prisma.participant.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.participant.delete({ where: { id } });
  },
};
