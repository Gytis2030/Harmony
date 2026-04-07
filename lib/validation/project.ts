import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(200).optional()
});

export type CreateProjectSchema = z.infer<typeof createProjectSchema>;
