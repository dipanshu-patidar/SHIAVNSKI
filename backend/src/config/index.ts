 import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const rawProviderMode = process.env.PROVIDER_MODE || process.env.VOICE_PROVIDER || 'mock';

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev-insecure-jwt-secret-min-16-chars'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  PROVIDER_MODE: z.enum(['mock', 'retell']).default('mock'),
  RETELL_API_KEY: z.string().optional().default(''),
  RETELL_WEBHOOK_KEY: z.string().optional().default(''),
  RETELL_FROM_NUMBER: z.string().optional().default('+14155551234'),
  RETELL_AGENT_ID: z.string().optional().default('agent_ba6661e78710d75a9fe62d6451'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsedEnv = envSchema.safeParse({
  ...process.env,
  PROVIDER_MODE: rawProviderMode.toLowerCase(),
  RETELL_WEBHOOK_KEY: process.env.RETELL_WEBHOOK_KEY || process.env.RETELL_WEBHOOK_SECRET || '',
});

if (!parsedEnv.success) {
  console.error('Invalid environment variables configuration:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  throw new Error('Environment validation failed');
}

export const config = parsedEnv.data;
export type Config = typeof config;

/**
 * Returns the effective signing key for Retell webhook signature verification.
 * Retell webhook signing keys with the "Webhook" badge use either the API key or dedicated webhook secret.
 */
export function getRetellWebhookKey(): string {
  return config.RETELL_WEBHOOK_KEY || config.RETELL_API_KEY || '';
}

/**
 * Returns a sanitized summary of provider configuration without exposing secrets.
 */
export function getSafeProviderConfig() {
  const hasApiKey = Boolean(config.RETELL_API_KEY && config.RETELL_API_KEY.trim() !== '');
  const hasWebhookKey = Boolean(getRetellWebhookKey() && getRetellWebhookKey().trim() !== '');
  const hasFromNumber = Boolean(config.RETELL_FROM_NUMBER && config.RETELL_FROM_NUMBER.trim() !== '');
  const hasAgentId = Boolean(config.RETELL_AGENT_ID && config.RETELL_AGENT_ID.trim() !== '');

  return {
    providerMode: config.PROVIDER_MODE,
    isMock: config.PROVIDER_MODE === 'mock',
    retell: {
      hasApiKey,
      hasWebhookKey,
      hasFromNumber,
      hasAgentId,
      agentIdConfigured: config.RETELL_AGENT_ID || null,
      fromNumberConfigured: config.RETELL_FROM_NUMBER || null,
      maskedApiKey: hasApiKey ? 'configured (hidden)' : 'not_configured',
      maskedWebhookKey: hasWebhookKey ? 'configured (hidden)' : 'not_configured',
    },
  };
}
