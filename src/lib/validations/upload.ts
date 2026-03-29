import { z } from "zod";

export const initEnrollmentUploadSchema = z.object({
  participantId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export const initSessionUploadSchema = z.object({
  sessionId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  type: z.enum(["SESSION_AUDIO", "SESSION_VIDEO"]),
});

export const completeUploadSchema = z.object({
  blobUrl: z.string().url(),
  sizeBytes: z.number().int().positive(),
  durationSec: z.number().positive().optional(),
});

export type InitEnrollmentUpload = z.infer<typeof initEnrollmentUploadSchema>;
export type InitSessionUpload = z.infer<typeof initSessionUploadSchema>;
export type CompleteUpload = z.infer<typeof completeUploadSchema>;
