import { z } from 'zod';

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.');

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: passwordSchema
});

export const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, 'Full name is required.').max(120).optional()
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type SignupSchema = z.infer<typeof signupSchema>;
