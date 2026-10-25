import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

describe('Provider Status & Harmless Connectivity Check API', () => {
  let authCookie: string;
  let testUserId: string;

  beforeAll(async () => {
    // Register test user for authenticated check
    const email = `provider_check_${Date.now()}@example.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!',
        fullName: 'Diagnostic Tester',
      });

    testUserId = regRes.body.data.user.id;
    const cookies = regRes.headers['set-cookie'];
    authCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }
  });

  it('GET /api/provider/status returns safe provider status without exposing secrets', async () => {
    const res = await request(app).get('/api/provider/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.providerMode).toBe('mock');
    expect(res.body.data.isMock).toBe(true);
    expect(res.body.data.retell).toBeDefined();

    // Verify secrets are NOT exposed
    const stringified = JSON.stringify(res.body);
    expect(stringified).not.toContain('your_retell_api_key_here');
    expect(res.body.data.retell.maskedApiKey).toBeDefined();
  });

  it('POST /api/provider/verify requires authentication', async () => {
    const res = await request(app).post('/api/provider/verify');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/provider/verify executes harmless read-only check when authenticated', async () => {
    const { providerStatusService } = await import('../../src/services/provider-status.service.js');
    const spy = vi.spyOn(providerStatusService, 'runConnectivityCheck').mockResolvedValueOnce({
      mode: 'mock',
      isLiveModeEnabled: false,
      configuration: {
        hasApiKey: true,
        hasWebhookKey: true,
        hasCallerNumber: true,
        hasAgentId: true,
        configuredFromNumber: '+14155551234',
        configuredAgentId: 'agent_ba6661e78710d75a9fe62d6451',
      },
      readiness: {
        apiAuthentication: true,
        callerNumberVerified: true,
        agentConfigured: true,
        webhookEndpointReady: true,
        readyForLiveCalls: true,
      },
      missingRequirements: [],
      recommendations: ['Published Retell Agent verified successfully'],
    });

    const res = await request(app)
      .post('/api/provider/verify')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.mode).toBe('mock');
    expect(res.body.data.readiness).toBeDefined();
    expect(res.body.data.recommendations).toBeInstanceOf(Array);

    spy.mockRestore();
  });
});
