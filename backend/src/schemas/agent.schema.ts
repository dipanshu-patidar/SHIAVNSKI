import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z
    .string({ required_error: 'Agent name is required' })
    .trim()
    .min(1, 'Agent name cannot be empty')
    .max(100, 'Agent name cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
  voiceId: z
    .string({ required_error: 'Voice selection is required' })
    .trim()
    .min(1, 'Voice ID is required')
    .max(100, 'Voice ID is too long'),
  language: z
    .string()
    .trim()
    .min(2, 'Language must be at least 2 characters')
    .max(20, 'Language identifier too long')
    .default('en-US'),
  systemPrompt: z
    .string({ required_error: 'System prompt instructions are required' })
    .trim()
    .min(5, 'System prompt must be at least 5 characters')
    .max(10000, 'System prompt cannot exceed 10000 characters'),
  responsiveness: z
    .number()
    .min(0.1, 'Responsiveness must be at least 0.1')
    .max(2.0, 'Responsiveness cannot exceed 2.0')
    .default(1.0),
  interruptionSensitivity: z
    .number()
    .min(0.0, 'Interruption sensitivity must be at least 0.0')
    .max(1.0, 'Interruption sensitivity cannot exceed 1.0')
    .default(0.8),
  isActive: z.boolean().default(true),
});

export const updateAgentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Agent name cannot be empty')
    .max(100, 'Agent name cannot exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
  voiceId: z
    .string()
    .trim()
    .min(1, 'Voice ID cannot be empty')
    .max(100, 'Voice ID is too long')
    .optional(),
  language: z
    .string()
    .trim()
    .min(2, 'Language must be at least 2 characters')
    .max(20, 'Language identifier too long')
    .optional(),
  systemPrompt: z
    .string()
    .trim()
    .min(5, 'System prompt must be at least 5 characters')
    .max(10000, 'System prompt cannot exceed 10000 characters')
    .optional(),
  responsiveness: z
    .number()
    .min(0.1, 'Responsiveness must be at least 0.1')
    .max(2.0, 'Responsiveness cannot exceed 2.0')
    .optional(),
  interruptionSensitivity: z
    .number()
    .min(0.0, 'Interruption sensitivity must be at least 0.0')
    .max(1.0, 'Interruption sensitivity cannot exceed 1.0')
    .optional(),
  isActive: z.boolean().optional(),
});

export const listAgentsQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type ListAgentsQuery = z.infer<typeof listAgentsQuerySchema>;
