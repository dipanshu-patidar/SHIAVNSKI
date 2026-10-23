import { z } from 'zod';

export const retellWebhookCallSchema = z.object({
  call_id: z.string({ required_error: 'call_id is required' }),
  agent_id: z.string().optional(),
  call_status: z.enum(['registered', 'ongoing', 'ended', 'error']).or(z.string()).optional(),
  start_timestamp: z.number().optional(),
  end_timestamp: z.number().optional(),
  duration_ms: z.number().optional(),
  transcript: z.string().optional(),
  transcript_object: z.any().optional(),
  recording_url: z.string().url().or(z.string()).optional(),
  disconnection_reason: z.string().optional(),
  call_analysis: z
    .object({
      call_summary: z.string().optional(),
      user_sentiment: z.string().optional(),
      call_successful: z.boolean().optional(),
      custom_analysis_data: z.any().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  retell_llm_dynamic_variables: z.record(z.unknown()).optional(),
});

export const retellWebhookSchema = z.object({
  event: z.string({ required_error: 'event type is required' }),
  call: retellWebhookCallSchema,
});

export type RetellWebhookPayload = z.infer<typeof retellWebhookSchema>;
