import { z } from "zod";

export const createParticipantSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  displayName: z.string().max(200).optional(),
});

export const updateParticipantSchema = z.object({
  displayName: z.string().max(200).optional(),
});

export type CreateParticipantInput = z.infer<typeof createParticipantSchema>;
export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;
