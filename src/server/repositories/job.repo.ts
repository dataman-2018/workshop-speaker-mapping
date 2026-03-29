import { prisma } from "@/lib/db/client";
import { ProcessingStatus } from "@prisma/client";

export const jobRepo = {
  async createJob(sessionId: string) {
    return prisma.processingJob.create({
      data: { sessionId },
    });
  },

  async getJob(id: string) {
    return prisma.processingJob.findUnique({
      where: { id },
    });
  },

  async getJobsBySession(sessionId: string) {
    return prisma.processingJob.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateJobStatus(
    id: string,
    status: ProcessingStatus,
    progress?: number,
    currentStep?: string,
    error?: string
  ) {
    return prisma.processingJob.update({
      where: { id },
      data: {
        status,
        ...(progress !== undefined && { progress }),
        ...(currentStep !== undefined && { currentStep }),
        ...(error !== undefined && { error }),
        ...(status === ProcessingStatus.ENROLLING && { startedAt: new Date() }),
        ...(status === ProcessingStatus.COMPLETED && {
          completedAt: new Date(),
        }),
        ...(status === ProcessingStatus.FAILED && { completedAt: new Date() }),
      },
    });
  },
};
