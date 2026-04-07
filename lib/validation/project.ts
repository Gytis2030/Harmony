import { z } from 'zod';

const optionalString = z.string().trim().max(200).optional().or(z.literal('')).transform((value) => (value ? value : undefined));

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(64, 'Project name must be 64 characters or fewer'),
  description: optionalString,
  bpm: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined || Number.isNaN(value)) return undefined;
      return Number(value);
    },
    z.number().int('BPM must be a whole number').min(1, 'BPM must be at least 1').max(300, 'BPM must be 300 or lower').optional()
  ),
  keySignature: z
    .string()
    .trim()
    .max(20, 'Key signature must be 20 characters or fewer')
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined))
});

export type CreateProjectSchema = z.infer<typeof createProjectSchema>;
