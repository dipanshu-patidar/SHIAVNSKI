import { z } from 'zod';
import { E164_REGEX } from '../utils/phone.util.js';

export const createCallSchema = z.object({
  agentId: z
    .string({ required_error: 'Voice agent selection is required' })
    .trim()
    .min(1, 'Agent ID is required'),
  toNumber: z
    .string({ required_error: 'Destination phone number is required' })
    .trim()
    .regex(
      E164_REGEX,
      'Destination number must be in valid international E.164 format (e.g. +14155552671 or +919876543210)'
    ),
  fromNumber: z
    .string()
    .trim()
    .regex(E164_REGEX, 'From number must be in valid E.164 format')
    .optional(),
  dynamicVariables: z
    .record(
      z
        .string()
        .regex(
          /^[a-zA-Z0-9_]{1,50}$/,
          'Variable keys must be alphanumeric or underscores (up to 50 characters)'
        ),
      z.string().max(500, 'Variable values must not exceed 500 characters')
    )
    .optional(),
});

export const listCallsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['INITIATED', 'ONGOING', 'ENDED', 'FAILED']).optional(),
  agentId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  sortBy: z.enum(['createdAt', 'durationSeconds', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dashboardMetricsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  agentId: z.string().trim().optional(),
  status: z.enum(['INITIATED', 'ONGOING', 'ENDED', 'FAILED', 'ALL']).optional(),
});

export type CreateCallInput = z.infer<typeof createCallSchema>;
export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;
export type DashboardMetricsQuery = z.infer<typeof dashboardMetricsQuerySchema>;
