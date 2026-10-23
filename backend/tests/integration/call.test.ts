import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();

describe('Outbound Call Management API Integration Tests (Phase 3)', () => {
  const timestamp = Date.now();
  const userAEmail = `call_owner_${timestamp}@shiavnski.com`;
  const userBEmail = `call_attacker_${timestamp}@shiavnski.com`;
  const testPassword = 'Password123!';

  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let userAAgentId: string;
  let inactiveAgentId: string;
  let createdCallId: string;

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app).post('/api/auth/register').send({
      fullName: 'Alice Caller',
      email: userAEmail,
      password: testPassword,
    });
    userACookie = resA.headers['set-cookie'][0];
    userAId = resA.body.data.user.id;

    // 2. Register User B
    const resB = await request(app).post('/api/auth/register').send({
      fullName: 'Bob Attacker',
      email: userBEmail,
      password: testPassword,
    });
    userBCookie = resB.headers['set-cookie'][0];
    userBId = resB.body.data.user.id;

    // 3. Create active agent for User A
    const agentRes = await request(app)
      .post('/api/agents')
      .set('Cookie', userACookie)
      .send({
        name: 'Appointment Scheduler Bot',
        voiceId: '11labs-Adrian',
        language: 'en-US',
        systemPrompt: 'You are an appointment scheduling assistant.',
        responsiveness: 1.0,
        interruptionSensitivity: 0.8,
        isActive: true,
      });
    userAAgentId = agentRes.body.data.agent.id;

    // 4. Create inactive agent for User A
    const inactiveRes = await request(app)
      .post('/api/agents')
      .set('Cookie', userACookie)
      .send({
        name: 'Deactivated Bot',
        voiceId: '11labs-Adrian',
        systemPrompt: 'Inactive persona instructions.',
        isActive: false,
      });
    inactiveAgentId = inactiveRes.body.data.agent.id;
  });

  afterAll(async () => {
    if (userAId) {
      await prisma.call.deleteMany({ where: { userId: userAId } });
      await prisma.agent.deleteMany({ where: { userId: userAId } });
      await prisma.user.deleteMany({ where: { id: userAId } });
    }
    if (userBId) {
      await prisma.call.deleteMany({ where: { userId: userBId } });
      await prisma.agent.deleteMany({ where: { userId: userBId } });
      await prisma.user.deleteMany({ where: { id: userBId } });
    }
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const postRes = await request(app).post('/api/calls').send({
      agentId: userAAgentId,
      toNumber: '+14155552671',
    });
    expect(postRes.status).toBe(401);
    expect(postRes.body.success).toBe(false);

    const getRes = await request(app).get('/api/calls');
    expect(getRes.status).toBe(401);
  });

  it('rejects invalid destination phone numbers with 400 VALIDATION_ERROR', async () => {
    const invalidNumbers = ['1234567', 'invalid-phone', '555-0199', '4155552671'];

    for (const num of invalidNumbers) {
      const res = await request(app)
        .post('/api/calls')
        .set('Cookie', userACookie)
        .send({
          agentId: userAAgentId,
          toNumber: num,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects malformed dynamic call variables with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set('Cookie', userACookie)
      .send({
        agentId: userAAgentId,
        toNumber: '+14155552671',
        dynamicVariables: {
          'invalid key with spaces': 'some value',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('prevents call dispatch using an inactive agent with 400 AGENT_INACTIVE', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set('Cookie', userACookie)
      .send({
        agentId: inactiveAgentId,
        toNumber: '+14155552671',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AGENT_INACTIVE');
  });

  it('ENFORCE MULTI-TENANT BOUNDARY: User B cannot dispatch calls using User A agent (404)', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set('Cookie', userBCookie)
      .send({
        agentId: userAAgentId, // Agent belongs to User A
        toNumber: '+14155552671',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('successfully dispatches mock call and persists in PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/calls')
      .set('Cookie', userACookie)
      .send({
        agentId: userAAgentId,
        toNumber: '+14155552671',
        dynamicVariables: {
          customer_name: 'David Miller',
          service_tier: 'Enterprise VIP',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const call = res.body.data.call;

    expect(call.id).toBeDefined();
    expect(call.userId).toBe(userAId);
    expect(call.agentId).toBe(userAAgentId);
    expect(call.toNumber).toBe('+14155552671');
    expect(call.maskedToNumber).toBe('+1 (415) ***-2671');
    expect(call.status).toBe('INITIATED');
    expect(call.providerCallId).toMatch(/^call_mock_/);
    expect(call.isMock).toBe(true);
    expect(call.dynamicVariables).toEqual({
      customer_name: 'David Miller',
      service_tier: 'Enterprise VIP',
    });

    createdCallId = call.id;

    // Verify record in PostgreSQL database
    const dbCall = await prisma.call.findUnique({
      where: { id: createdCallId },
    });
    expect(dbCall).not.toBeNull();
    expect(dbCall?.userId).toBe(userAId);
    expect(dbCall?.status).toBe('INITIATED');
    // Ensure no fake transcripts or fake recordings are pre-populated
    expect(dbCall?.transcriptText).toBeNull();
    expect(dbCall?.recordingUrl).toBeNull();
  });

  it('prevents accidental duplicate submissions via idempotency key', async () => {
    const idempotencyKey = `idem_${Date.now()}_test`;

    const res1 = await request(app)
      .post('/api/calls')
      .set('Cookie', userACookie)
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        agentId: userAAgentId,
        toNumber: '+12025550143',
      });

    expect(res1.status).toBe(201);
    const firstCallId = res1.body.data.call.id;

    // Immediate second submission with identical idempotency key
    const res2 = await request(app)
      .post('/api/calls')
      .set('Cookie', userACookie)
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        agentId: userAAgentId,
        toNumber: '+12025550143',
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.call.id).toBe(firstCallId);

    // Verify only ONE call record was created in the database for this number
    const count = await prisma.call.count({
      where: {
        userId: userAId,
        toNumber: '+12025550143',
      },
    });
    expect(count).toBe(1);
  });

  it('GET /api/calls lists authenticated user calls with pagination and filters', async () => {
    const res = await request(app).get('/api/calls').set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.calls).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.calls.some((c: { id: string }) => c.id === createdCallId)).toBe(true);

    // Verify phone number is masked
    const callItem = res.body.data.calls.find((c: { id: string }) => c.id === createdCallId);
    expect(callItem.maskedToNumber).toBe('+1 (415) ***-2671');
    expect(callItem.isMock).toBe(true);

    // Test filter by status
    const filterRes = await request(app)
      .get('/api/calls?status=INITIATED')
      .set('Cookie', userACookie);
    expect(filterRes.status).toBe(200);
    expect(filterRes.body.data.calls.every((c: { status: string }) => c.status === 'INITIATED')).toBe(
      true
    );
  });

  it('GET /api/calls/:id returns call details for owner', async () => {
    const res = await request(app)
      .get(`/api/calls/${createdCallId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.call.id).toBe(createdCallId);
    expect(res.body.data.call.agent.id).toBe(userAAgentId);
  });

  it('GET /api/calls/:id returns 404 for non-existent call ID', async () => {
    const res = await request(app)
      .get('/api/calls/non_existent_call_id_123')
      .set('Cookie', userACookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CALL_NOT_FOUND');
  });

  it('ENFORCE MULTI-TENANT BOUNDARY: User B cannot view User A call details or listing', async () => {
    // 1. User B tries to get User A's call -> 404
    const getRes = await request(app)
      .get(`/api/calls/${createdCallId}`)
      .set('Cookie', userBCookie);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe('CALL_NOT_FOUND');

    // 2. User B lists calls -> does NOT contain User A's call
    const listRes = await request(app).get('/api/calls').set('Cookie', userBCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.calls.some((c: { id: string }) => c.id === createdCallId)).toBe(false);
  });

  it('GET /api/calls/:id masks recipient and caller ID for privacy protection', async () => {
    const res = await request(app)
      .get(`/api/calls/${createdCallId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    const call = res.body.data.call;
    expect(call.toNumber).toBe('+1 (415) ***-2671');
    expect(call.fromNumber).toBe('+1 (415) ***-1234');
    expect(call.maskedToNumber).toBe('+1 (415) ***-2671');
    expect(call.maskedFromNumber).toBe('+1 (415) ***-1234');
  });

  it('MOCK LIFECYCLE: POST /api/calls/:id/simulate-step advances call through INITIATED -> ONGOING -> ENDED', async () => {
    // 1. Initial state is INITIATED
    const preCheck = await request(app)
      .get(`/api/calls/${createdCallId}`)
      .set('Cookie', userACookie);
    expect(preCheck.body.data.call.status).toBe('INITIATED');

    // 2. First simulation step: INITIATED -> ONGOING (simulated answer)
    const step1 = await request(app)
      .post(`/api/calls/${createdCallId}/simulate-step`)
      .set('Cookie', userACookie);

    expect(step1.status).toBe(200);
    expect(step1.body.success).toBe(true);
    expect(step1.body.data.call.status).toBe('ONGOING');

    // 3. Second simulation step: ONGOING -> ENDED (simulated completion)
    const step2 = await request(app)
      .post(`/api/calls/${createdCallId}/simulate-step`)
      .set('Cookie', userACookie);

    expect(step2.status).toBe(200);
    expect(step2.body.data.call.status).toBe('ENDED');
    expect(step2.body.data.call.disconnectionReason).toBe('simulated_user_hangup');
    expect(step2.body.data.call.durationSeconds).toBeGreaterThanOrEqual(5);

    // 4. Verify cross-user ownership isolation: User B cannot simulate User A's call (404)
    const crossUserRes = await request(app)
      .post(`/api/calls/${createdCallId}/simulate-step`)
      .set('Cookie', userBCookie);

    expect(crossUserRes.status).toBe(404);
    expect(crossUserRes.body.error.code).toBe('CALL_NOT_FOUND');
  });

  it('DASHBOARD METRICS: GET /api/calls/stats aggregates KPIs from persisted database records with user isolation', async () => {
    // 1. Fetch metrics for User A (who has 1 ended call with duration >= 5s from the previous test)
    const resA = await request(app)
      .get('/api/calls/stats')
      .set('Cookie', userACookie);

    expect(resA.status).toBe(200);
    expect(resA.body.success).toBe(true);
    const metricsA = resA.body.data;

    expect(metricsA.totalCalls).toBe(2);
    expect(metricsA.completedCalls).toBe(1);
    expect(metricsA.initiatedCalls).toBe(1);
    expect(metricsA.failedCalls).toBe(0);
    expect(metricsA.avgDurationSeconds).toBeGreaterThanOrEqual(5);
    expect(metricsA.successRate).toBe(50);
    expect(metricsA.activeAgents).toBe(1); // Appointment Scheduler Bot
    expect(Array.isArray(metricsA.recentCalls)).toBe(true);
    expect(metricsA.recentCalls.length).toBe(2);
    expect(metricsA.recentCalls[0].maskedToNumber).toBeDefined();

    // 2. Fetch metrics for User B (multi-tenant isolation: User B has 0 calls)
    const resB = await request(app)
      .get('/api/calls/stats')
      .set('Cookie', userBCookie);

    expect(resB.status).toBe(200);
    const metricsB = resB.body.data;
    expect(metricsB.totalCalls).toBe(0);
    expect(metricsB.completedCalls).toBe(0);
    expect(metricsB.failedCalls).toBe(0);
    expect(metricsB.avgDurationSeconds).toBe(0);
    expect(metricsB.successRate).toBe(0);
    expect(metricsB.recentCalls).toEqual([]);

    // 3. Test filtering by status: status=FAILED should return 0 calls for User A
    const resFilteredStatus = await request(app)
      .get('/api/calls/stats?status=FAILED')
      .set('Cookie', userACookie);

    expect(resFilteredStatus.status).toBe(200);
    expect(resFilteredStatus.body.data.totalCalls).toBe(0);
    expect(resFilteredStatus.body.data.recentCalls).toEqual([]);

    // 4. Test filtering by agent: filtering by inactiveAgentId should return 0 calls
    const resFilteredAgent = await request(app)
      .get(`/api/calls/stats?agentId=${inactiveAgentId}`)
      .set('Cookie', userACookie);

    expect(resFilteredAgent.status).toBe(200);
    expect(resFilteredAgent.body.data.totalCalls).toBe(0);

    // 5. Test filtering by active agent: should return User A's call
    const resActiveAgent = await request(app)
      .get(`/api/calls/stats?agentId=${userAAgentId}`)
      .set('Cookie', userACookie);

    expect(resActiveAgent.status).toBe(200);
    expect(resActiveAgent.body.data.totalCalls).toBeGreaterThanOrEqual(1);

    // 6. Test invalid status query: should return 400 VALIDATION_ERROR
    const resInvalidStatus = await request(app)
      .get('/api/calls/stats?status=INVALID_STATUS')
      .set('Cookie', userACookie);

    expect(resInvalidStatus.status).toBe(400);
    expect(resInvalidStatus.body.success).toBe(false);

    // 7. Test boundary date range: future startDate should return 0 calls
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
    const resFuture = await request(app)
      .get(`/api/calls/stats?startDate=${futureDate}`)
      .set('Cookie', userACookie);

    expect(resFuture.status).toBe(200);
    expect(resFuture.body.data.totalCalls).toBe(0);
    expect(resFuture.body.data.recentCalls).toEqual([]);

    // 8. Past date range should include existing calls
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const resPast = await request(app)
      .get(`/api/calls/stats?startDate=${pastDate}`)
      .set('Cookie', userACookie);

    expect(resPast.status).toBe(200);
    expect(resPast.body.data.totalCalls).toBeGreaterThanOrEqual(1);
  });
});
