import { prisma } from "@/lib/db/client";

interface CreateUtteranceInput {
  startTime: number;
  endTime: number;
  text: string;
  speakerCluster: string | null;
  confidence: number;
  participantId: string | null;
  matchConfidence: number;
}

export const utteranceRepo = {
  async createUtterances(sessionId: string, utterances: CreateUtteranceInput[]) {
    // Use a transaction to create utterances and their assignments atomically
    return prisma.$transaction(
      utterances.map((u) =>
        prisma.transcriptUtterance.create({
          data: {
            sessionId,
            startTime: u.startTime,
            endTime: u.endTime,
            text: u.text,
            speakerCluster: u.speakerCluster,
            confidence: u.confidence,
            assignment: {
              create: {
                participantId: u.participantId,
                confidence: u.matchConfidence,
                isManual: false,
              },
            },
          },
          include: { assignment: true },
        })
      )
    );
  },

  async getBySession(sessionId: string) {
    return prisma.transcriptUtterance.findMany({
      where: { sessionId },
      include: {
        assignment: {
          include: { participant: true },
        },
      },
      orderBy: { startTime: "asc" },
    });
  },

  async updateAssignment(
    utteranceId: string,
    participantId: string | null,
    isManual: boolean
  ) {
    return prisma.speakerAssignment.upsert({
      where: { utteranceId },
      update: {
        participantId,
        isManual,
      },
      create: {
        utteranceId,
        participantId,
        isManual,
        confidence: isManual ? 1.0 : 0,
      },
    });
  },

  async deleteBySession(sessionId: string) {
    // Cascade from utterances will delete assignments
    return prisma.transcriptUtterance.deleteMany({
      where: { sessionId },
    });
  },
};
