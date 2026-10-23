import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { sign } from 'retell-sdk';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { getRetellWebhookKey } from '../../src/config/index.js';

describe('Retell Webhook Ingestion & Idempotency Integration Tests', () => {
  let testUserId: string;
  let testAgentId: string;
  let testCallId: string;
  const mockProviderCallId = `call_test_retell_${Date.now()}`;
  const webhookKey = getRetellWebhookKey() || 'test_webhook_key_123';

  beforeAll(async () => {
    // 1. Create a isolated test user
    const user = await prisma.user.create({
      data: {
        email: `webhook_tester_${Date.now()}@example.com`,
        passwordHash: 'insecure_test_hash',
        fullName: 'Webhook Test User',
      },
    });
    testUserId = user.id;

    // 2. Create a test agent
    const agent = await prisma.agent.create({
      data: {
        userId: testUserId,
        providerAgentId: `agent_retell_test_${Date.now()}`,
        name: 'Webhook Inbound Agent',
        voiceId: '11labs-Adrian',
        language: 'en-US',
        systemPrompt: 'You handle incoming telemetry',
      },
    });
    testAgentId = agent.id;

    // 3. Create a Call record in PostgreSQL
    const call = await prisma.call.create({
      data: {
        userId: testUserId,
        agentId: testAgentId,
        providerCallId: mockProviderCallId,
        fromNumber: '+14155551234',
        toNumber: '+14155552671',
        status: 'INITIATED',
        durationSeconds: 0,
      },
    });
    testCallId = call.id;
  });

  afterAll(async () => {
    // Cleanup in order
    await prisma.webhookEvent.deleteMany({
      where: { providerCallId: mockProviderCallId },
    });
    await prisma.call.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.agent.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  it('rejects webhook request when x-retell-signature header is missing', async () => {
    const payload = {
      event: 'call_started',
      call: { call_id: mockProviderCallId },
    };

    const res = await request(app)
      .post('/api/webhooks/retell')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Missing x-retell-signature header');
  });

  it('rejects webhook request when signature is invalid', async () => {
    const payload = {
      event: 'call_started',
      call: { call_id: mockProviderCallId },
    };

    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('x-retell-signature', 'v=1234567890,d=invalidhexsignature')
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid webhook signature');
  });

  it('successfully processes valid call_started event with valid Retell signature', async () => {
    const payload = {
      event: 'call_started',
      call: {
        call_id: mockProviderCallId,
        agent_id: 'agent_mock_test',
        call_status: 'ongoing',
        start_timestamp: Date.now(),
      },
    };

    const rawBody = JSON.stringify(payload);
    const validSignature = await sign(rawBody, webhookKey);

    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', validSignature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PROCESSED');
    expect(res.body.data.duplicate).toBe(false);

    // Verify DB Call record state transition to ONGOING
    const updatedCall = await prisma.call.findUnique({
      where: { id: testCallId },
    });
    expect(updatedCall?.status).toBe('ONGOING');
    expect(updatedCall?.startedAt).toBeDefined();
  });

  it('idempotently handles duplicate call_started webhook delivery without re-execution', async () => {
    const payload = {
      event: 'call_started',
      call: {
        call_id: mockProviderCallId,
        call_status: 'ongoing',
        start_timestamp: 1700000000000,
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = await sign(rawBody, webhookKey);

    // First delivery
    const res1 = await request(app)
      .post('/api/webhooks/retell')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signature)
      .send(rawBody);

    expect(res1.status).toBe(200);

    // Duplicate delivery
    const res2 = await request(app)
      .post('/api/webhooks/retell')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signature)
      .send(rawBody);

    expect(res2.status).toBe(200);
    expect(res2.body.data.duplicate).toBe(true);
    expect(res2.body.data.idempotent).toBe(true);

    // Verify retry count in webhook_events table was incremented on the duplicate event
    const eventRecord = await prisma.webhookEvent.findFirst({
      where: {
        providerCallId: mockProviderCallId,
        eventType: 'call_started',
        eventTimestamp: new Date(1700000000000),
      },
    });
    expect(eventRecord?.retryCount).toBeGreaterThanOrEqual(1);
  });

  it('processes call_ended event and updates duration, transcript, and recording URL', async () => {
    const endTimestamp = Date.now();
    const payload = {
      event: 'call_ended',
      call: {
        call_id: mockProviderCallId,
        call_status: 'ended',
        start_timestamp: endTimestamp - 65000,
        end_timestamp: endTimestamp,
        duration_ms: 65000,
        disconnection_reason: 'user_hangup',
        transcript: 'Customer: Hello agent. Agent: Hello, how can I help you?',
        recording_url: 'https://api.retellai.com/recordings/test.wav',
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = await sign(rawBody, webhookKey);

    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify DB Call record state transition to ENDED with telemetry
    const updatedCall = await prisma.call.findUnique({
      where: { id: testCallId },
    });
    expect(updatedCall?.status).toBe('ENDED');
    expect(updatedCall?.durationSeconds).toBe(65);
    expect(updatedCall?.disconnectionReason).toBe('user_hangup');
    expect(updatedCall?.transcriptText).toContain('Customer: Hello agent');
    expect(updatedCall?.recordingUrl).toBe('https://api.retellai.com/recordings/test.wav');
    expect(updatedCall?.endedAt).toBeDefined();
  });

  it('processes call_analyzed event and updates summary, sentiment, and success status', async () => {
    const payload = {
      event: 'call_analyzed',
      call: {
        call_id: mockProviderCallId,
        call_analysis: {
          call_summary: 'Customer scheduled a demo for tomorrow morning.',
          user_sentiment: 'Positive',
          call_successful: true,
          custom_analysis_data: { lead_qualified: true },
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = await sign(rawBody, webhookKey);

    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signature)
      .send(rawBody);

    expect(res.status).toBe(200);

    const updatedCall = await prisma.call.findUnique({
      where: { id: testCallId },
    });
    expect(updatedCall?.summary).toBe('Customer scheduled a demo for tomorrow morning.');
    expect(updatedCall?.sentiment).toBe('Positive');
    expect(updatedCall?.callSuccessful).toBe(true);
    expect((updatedCall?.customAnalysis as any)?.lead_qualified).toBe(true);
  });

  it('acknowledges orphan webhook event without crashing or failing Retell retry queue', async () => {
    const orphanCallId = `call_orphan_untracked_${Date.now()}`;
    const payload = {
      event: 'call_ended',
      call: {
        call_id: orphanCallId,
        call_status: 'ended',
        duration_ms: 10000,
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = await sign(rawBody, webhookKey);

    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING_ORPHAN');

    // Clean up orphan event
    await prisma.webhookEvent.deleteMany({
      where: { providerCallId: orphanCallId },
    });
  });

  it('TERMINAL STATE PROTECTION: out-of-order call_started event does NOT regress ENDED call status', async () => {
    // Current state of testCallId is ENDED from the previous test
    const preCheck = await prisma.call.findUnique({ where: { id: testCallId } });
    expect(preCheck?.status).toBe('ENDED');

    // Simulate delayed / out-of-order call_started event
    const outOfOrderPayload = {
      event: 'call_started',
      call: {
        call_id: mockProviderCallId,
        call_status: 'ongoing',
        start_timestamp: Date.now() - 100000,
      },
    };

    const rawBody = JSON.stringify(outOfOrderPayload);
    const signature = await sign(rawBody, webhookKey);

    const res = await request(app)
      .post('/api/webhooks/retell')
      .set('Content-Type', 'application/json')
      .set('x-retell-signature', signature)
      .send(rawBody);

    expect(res.status).toBe(200);

    // Verify call status remains strictly ENDED and was NOT regressed to ONGOING
    const postCheck = await prisma.call.findUnique({ where: { id: testCallId } });
    expect(postCheck?.status).toBe('ENDED');
    expect(postCheck?.durationSeconds).toBe(65);
  });
});
