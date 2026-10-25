import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();

describe('Web Call & Call Recording Management API Integration Tests', () => {
  const timestamp = Date.now();
  const userAEmail = `webcall_owner_${timestamp}@shiavnski.com`;
  const userBEmail = `webcall_attacker_${timestamp}@shiavnski.com`;
  const testPassword = 'Password123!';

  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let userAAgentId: string;
  let inactiveAgentId: string;
  let createdWebCallId: string;

  beforeAll(async () => {
    // 1. Register User A (owner)
    const resA = await request(app).post('/api/auth/register').send({
      fullName: 'Alice VoiceUser',
      email: userAEmail,
      password: testPassword,
    });
    userACookie = resA.headers['set-cookie'][0];
    userAId = resA.body.data.user.id;

    // 2. Register User B (attacker)
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
        name: 'Shiavnski Web Voice Assistant',
        voiceId: 'retell-Cimo',
        language: 'en-US',
        systemPrompt: 'You are Shiavnski AI browser voice assistant.',
        responsiveness: 1.0,
        interruptionSensitivity: 0.9,
        isActive: true,
      });
    userAAgentId = agentRes.body.data.agent.id;

    // 4. Create inactive agent for User A
    const inactiveRes = await request(app)
      .post('/api/agents')
      .set('Cookie', userACookie)
      .send({
        name: 'Inactive Assistant',
        voiceId: 'retell-Cimo',
        language: 'en-US',
        systemPrompt: 'Inactive persona.',
        responsiveness: 1.0,
        interruptionSensitivity: 0.8,
        isActive: false,
      });
    inactiveAgentId = inactiveRes.body.data.agent.id;
  });

  afterAll(async () => {
    await prisma.call.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.agent.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  describe('POST /api/calls/web-call: Browser WebRTC Session Creation', () => {
    it('requires authentication to initiate web call session', async () => {
      const res = await request(app)
        .post('/api/calls/web-call')
        .send({ agentId: userAAgentId });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects web call creation for non-existent agent', async () => {
      const res = await request(app)
        .post('/api/calls/web-call')
        .set('Cookie', userACookie)
        .send({ agentId: 'non_existent_cuid' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('rejects web call creation for inactive agent', async () => {
      const res = await request(app)
        .post('/api/calls/web-call')
        .set('Cookie', userACookie)
        .send({ agentId: inactiveAgentId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AGENT_INACTIVE');
    });

    it('enforces tenant isolation: User B cannot start web call using User A agent', async () => {
      const res = await request(app)
        .post('/api/calls/web-call')
        .set('Cookie', userBCookie)
        .send({ agentId: userAAgentId });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('successfully creates a browser web call session and returns accessToken + call record', async () => {
      const res = await request(app)
        .post('/api/calls/web-call')
        .set('Cookie', userACookie)
        .send({
          agentId: userAAgentId,
          dynamicVariables: {
            user_intent: 'browser_support_demo',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.call).toBeDefined();
      expect(res.body.data.call.callType).toBe('web_call');
      expect(res.body.data.call.providerCallId).toBeDefined();
      expect(res.body.data.call.status).toBe('INITIATED');
      expect(res.body.data.call.agent.name).toBe('Shiavnski Web Voice Assistant');

      createdWebCallId = res.body.data.call.id;

      // Verify PostgreSQL persistence
      const dbCall = await prisma.call.findUnique({
        where: { id: createdWebCallId },
      });
      expect(dbCall).not.toBeNull();
      expect(dbCall?.callType).toBe('web_call');
      expect(dbCall?.userId).toBe(userAId);
    });
  });

  describe('Call Details & Synchronization (GET /api/calls/:id & POST /api/calls/:id/sync)', () => {
    it('retrieves created web call details with speaker labels and metadata structure', async () => {
      const res = await request(app)
        .get(`/api/calls/${createdWebCallId}`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.call.id).toBe(createdWebCallId);
      expect(res.body.data.call.callType).toBe('web_call');
    });

    it('POST /api/calls/:id/sync executes safely and updates call record', async () => {
      const res = await request(app)
        .post(`/api/calls/${createdWebCallId}/sync`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.call.id).toBe(createdWebCallId);
    });

    it('enforces tenant isolation on sync endpoint: User B cannot sync User A call', async () => {
      const res = await request(app)
        .post(`/api/calls/${createdWebCallId}/sync`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CALL_NOT_FOUND');
    });
  });

  describe('DELETE /api/calls/:id/recording: Recording Deletion & Preservation', () => {
    let callWithRecordingId: string;

    beforeAll(async () => {
      // Seed a completed call with simulated recording and transcript in DB
      const completedCall = await prisma.call.create({
        data: {
          userId: userAId,
          agentId: userAAgentId,
          providerCallId: `call_mock_rec_${timestamp}_123`,
          callType: 'web_call',
          fromNumber: 'Browser Client',
          toNumber: 'Shiavnski Web Voice Assistant',
          status: 'ENDED',
          durationSeconds: 42,
          recordingUrl: 'https://storage.provider.com/recordings/test_sample_audio.mp3',
          recordingMultiChannelUrl: 'https://storage.provider.com/recordings/test_multichannel.mp3',
          recordingStatus: 'available',
          transcriptText: 'User: Hello Shiavnski.\nAgent: Hello! How can I assist you today?',
          summary: 'Inquiry about software services.',
          sentiment: 'positive',
          callSuccessful: true,
          startedAt: new Date(Date.now() - 42000),
          endedAt: new Date(),
        },
      });
      callWithRecordingId = completedCall.id;
    });

    it('requires authentication to delete recording', async () => {
      const res = await request(app).delete(`/api/calls/${callWithRecordingId}/recording`);
      expect(res.status).toBe(401);
    });

    it('enforces tenant isolation: User B cannot delete User A recording', async () => {
      const res = await request(app)
        .delete(`/api/calls/${callWithRecordingId}/recording`)
        .set('Cookie', userBCookie);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CALL_NOT_FOUND');

      // Verify recording was NOT removed
      const checkDb = await prisma.call.findUnique({ where: { id: callWithRecordingId } });
      expect(checkDb?.recordingUrl).not.toBeNull();
    });

    it('successfully deletes recording reference while preserving entire call history and transcript', async () => {
      const res = await request(app)
        .delete(`/api/calls/${callWithRecordingId}/recording`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.call.recordingUrl).toBeNull();
      expect(res.body.data.call.recordingStatus).toBe('removed');

      // Verify in PostgreSQL: Recording URLs are cleared, but Call row is strictly preserved!
      const dbCallAfter = await prisma.call.findUnique({
        where: { id: callWithRecordingId },
      });

      expect(dbCallAfter).not.toBeNull();
      expect(dbCallAfter?.recordingUrl).toBeNull();
      expect(dbCallAfter?.recordingMultiChannelUrl).toBeNull();
      expect(dbCallAfter?.recordingStatus).toBe('removed');

      // Crucial: Call metadata, duration, transcript, and summary are preserved
      expect(dbCallAfter?.durationSeconds).toBe(42);
      expect(dbCallAfter?.transcriptText).toContain('Hello Shiavnski');
      expect(dbCallAfter?.summary).toBe('Inquiry about software services.');
      expect(dbCallAfter?.sentiment).toBe('positive');
      expect(dbCallAfter?.status).toBe('ENDED');
    });

    it('handles idempotent subsequent deletion gracefully without error', async () => {
      const res = await request(app)
        .delete(`/api/calls/${callWithRecordingId}/recording`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.call.recordingUrl).toBeNull();
    });
  });
});
