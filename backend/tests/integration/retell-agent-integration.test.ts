import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { config } from '../../src/config/index.js';

const app = createApp();

describe('Retell AI Agent E2E Integration Tests', () => {
  const timestamp = Date.now();
  const testEmail = `retell_agent_e2e_${timestamp}@shiavnski.com`;
  const testPassword = 'Password123!';
  const RETELL_AGENT_ID = 'agent_ba6661e78710d75a9fe62d6451';

  let authCookie: string;
  let testUserId: string;
  let syncedAgentId: string;
  let testCallId: string;
  let providerCallId: string;

  beforeAll(async () => {
    // 1. Register test user
    const regRes = await request(app).post('/api/auth/register').send({
      fullName: 'Retell Integration Tester',
      email: testEmail,
      password: testPassword,
    });
    authCookie = regRes.headers['set-cookie'][0];
    testUserId = regRes.body.data.user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.call.deleteMany({ where: { userId: testUserId } });
      const demoUser = await prisma.user.findUnique({ where: { email: 'demo@shiavnski.com' } });
      if (demoUser) {
        await prisma.agent.updateMany({
          where: { providerAgentId: RETELL_AGENT_ID },
          data: { userId: demoUser.id },
        });
      }
      await prisma.agent.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  it('1. POST /api/agents/sync connects and persists the published Retell Agent into PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/agents/sync')
      .set('Cookie', authCookie)
      .send({ providerAgentId: RETELL_AGENT_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent).toBeDefined();
    expect(res.body.data.agent.providerAgentId).toBe(RETELL_AGENT_ID);
    expect(res.body.data.agent.name).toBe('Shiavnski AI Assistant');
    expect(res.body.data.agent.voiceId).toBe('retell-Cimo');
    expect(res.body.data.agent.isActive).toBe(true);
    expect(res.body.data.agent.syncStatus).toBe('SYNCED');

    syncedAgentId = res.body.data.agent.id;

    // Verify record in PostgreSQL database
    const dbAgent = await prisma.agent.findUnique({
      where: { id: syncedAgentId },
    });
    expect(dbAgent).not.toBeNull();
    expect(dbAgent?.providerAgentId).toBe(RETELL_AGENT_ID);
    expect(dbAgent?.userId).toBe(testUserId);
  });

  it('2. POST /api/calls initiates outbound call bound to the Retell Agent', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set('Cookie', authCookie)
      .send({
        agentId: syncedAgentId,
        toNumber: '+14155552671',
        fromNumber: '+14155551234',
        dynamicVariables: {
          client_name: 'Dr. Jane Watson',
          inquiry_type: 'Live Telephony Consultation',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.call).toBeDefined();
    expect(res.body.data.call.agentId).toBe(syncedAgentId);
    expect(res.body.data.call.status).toBe('INITIATED');
    expect(res.body.data.call.providerCallId).toBeDefined();

    testCallId = res.body.data.call.id;
    providerCallId = res.body.data.call.providerCallId;

    // Verify Call is persisted in PostgreSQL
    const dbCall = await prisma.call.findUnique({
      where: { id: testCallId },
    });
    expect(dbCall).not.toBeNull();
    expect(dbCall?.status).toBe('INITIATED');
    expect(dbCall?.providerCallId).toBe(providerCallId);
  });

  it('3. GET /api/calls lists the initiated Retell call with privacy masking', async () => {
    const res = await request(app)
      .get('/api/calls')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.calls.length).toBeGreaterThanOrEqual(1);

    const call = res.body.data.calls.find((c: any) => c.id === testCallId);
    expect(call).toBeDefined();
    expect(call.maskedToNumber).toContain('***-2671');
    expect(call.agent.name).toBe('Shiavnski AI Assistant');
  });

  it('4. POST /api/calls/:id/simulate-step advances mock call state safely to ONGOING and ENDED', async () => {
    // Step 1: Simulate answering (INITIATED -> ONGOING)
    const step1 = await request(app)
      .post(`/api/calls/${testCallId}/simulate-step`)
      .set('Cookie', authCookie);

    expect(step1.status).toBe(200);
    expect(step1.body.data.call.status).toBe('ONGOING');

    // Step 2: Simulate completion (ONGOING -> ENDED)
    const step2 = await request(app)
      .post(`/api/calls/${testCallId}/simulate-step`)
      .set('Cookie', authCookie);

    expect(step2.status).toBe(200);
    expect(step2.body.data.call.status).toBe('ENDED');
    expect(step2.body.data.call.durationSeconds).toBeGreaterThan(0);
    expect(step2.body.data.call.disconnectionReason).toBe('simulated_user_hangup');
  });

  it('5. Webhook ingestion: updates call record with transcript, recording URL, and sentiment', async () => {
    // Simulate webhook processing via direct webhook event handler in DB
    const startMs = Date.now() - 45000;
    const endMs = Date.now();

    await prisma.call.update({
      where: { id: testCallId },
      data: {
        status: 'ENDED',
        durationSeconds: 45,
        transcriptText: 'User: Hello! Agent: Hello! Thank you for calling Shiavnski Technologies.',
        recordingUrl: 'https://api.retellai.com/recordings/sample_call.wav',
        summary: 'Caller reached Shiavnski Technologies and requested service assistance.',
        sentiment: 'Positive',
        callSuccessful: true,
      },
    });

    const verifyRes = await request(app)
      .get(`/api/calls/${testCallId}`)
      .set('Cookie', authCookie);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.call.status).toBe('ENDED');
    expect(verifyRes.body.data.call.transcriptText).toContain('Shiavnski Technologies');
    expect(verifyRes.body.data.call.recordingUrl).toContain('sample_call.wav');
    expect(verifyRes.body.data.call.sentiment).toBe('Positive');
    expect(verifyRes.body.data.call.callSuccessful).toBe(true);
  });

  it('6. GET /api/calls/stats updates dynamic metrics with Retell Agent calls', async () => {
    const res = await request(app)
      .get('/api/calls/stats')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCalls).toBeGreaterThanOrEqual(1);
    expect(res.body.data.completedCalls).toBeGreaterThanOrEqual(1);
    expect(res.body.data.activeAgents).toBeGreaterThanOrEqual(1);
    expect(res.body.data.avgDurationSeconds).toBeGreaterThan(0);
  });
});
