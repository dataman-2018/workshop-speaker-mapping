import { z } from "zod";

export const createSessionSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  projectId: z.string().min(1, "Project ID is required"),
});

export const updateSessionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
