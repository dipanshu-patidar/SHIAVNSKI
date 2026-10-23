import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();

describe('Agent Management API Integration Tests', () => {
  const timestamp = Date.now();
  const userAEmail = `user_a_${timestamp}@shiavnski.com`;
  const userBEmail = `user_b_${timestamp}@shiavnski.com`;
  const testPassword = 'Password123!';

  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;
  let createdAgentId: string;

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app).post('/api/auth/register').send({
      fullName: 'Agent Owner Alice',
      email: userAEmail,
      password: testPassword,
    });
    userACookie = resA.headers['set-cookie'][0];
    userAId = resA.body.data.user.id;

    // 2. Register User B (for cross-user tenant boundary testing)
    const resB = await request(app).post('/api/auth/register').send({
      fullName: 'Attacker Bob',
      email: userBEmail,
      password: testPassword,
    });
    userBCookie = resB.headers['set-cookie'][0];
    userBId = resB.body.data.user.id;
  });

  afterAll(async () => {
    // Clean up created test data
    if (userAId) {
      await prisma.agent.deleteMany({ where: { userId: userAId } });
      await prisma.user.deleteMany({ where: { id: userAId } });
    }
    if (userBId) {
      await prisma.agent.deleteMany({ where: { userId: userBId } });
      await prisma.user.deleteMany({ where: { id: userBId } });
    }
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests to agent endpoints with 401 UNAUTHORIZED', async () => {
    const listRes = await request(app).get('/api/agents');
    expect(listRes.status).toBe(401);
    expect(listRes.body.success).toBe(false);

    const createRes = await request(app).post('/api/agents').send({
      name: 'Unauth Agent',
      voiceId: '11labs-Adrian',
      systemPrompt: 'Instructions for unauthenticated call',
    });
    expect(createRes.status).toBe(401);
  });

  it('POST /api/agents should validate input payload and reject invalid fields', async () => {
    // Empty name
    const res1 = await request(app)
      .post('/api/agents')
      .set('Cookie', userACookie)
      .send({
        name: '',
        voiceId: '11labs-Adrian',
        systemPrompt: 'Valid prompt instructions here',
      });
    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe('VALIDATION_ERROR');

    // Missing voiceId
    const res2 = await request(app)
      .post('/api/agents')
      .set('Cookie', userACookie)
      .send({
        name: 'Test Voice Agent',
        systemPrompt: 'Valid prompt instructions here',
      });
    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('VALIDATION_ERROR');

    // System prompt too short
    const res3 = await request(app)
      .post('/api/agents')
      .set('Cookie', userACookie)
      .send({
        name: 'Test Voice Agent',
        voiceId: '11labs-Adrian',
        systemPrompt: 'Hi',
      });
    expect(res3.status).toBe(400);
    expect(res3.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/agents should create an agent, generate a mock provider ID, and persist in Postgres', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', userACookie)
      .send({
        name: 'Sales Concierge Alpha',
        description: 'Lead qualification and customer support bot',
        voiceId: '11labs-Adrian',
        language: 'en-US',
        systemPrompt: 'You are a professional voice concierge for Acme Corporation.',
        responsiveness: 1.0,
        interruptionSensitivity: 0.8,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const agent = res.body.data.agent;
    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.name).toBe('Sales Concierge Alpha');
    expect(agent.description).toBe('Lead qualification and customer support bot');
    expect(agent.voiceId).toBe('11labs-Adrian');
    expect(agent.language).toBe('en-US');
    expect(agent.responsiveness).toBe(1.0);
    expect(agent.interruptionSensitivity).toBe(0.8);
    expect(agent.syncStatus).toBe('SYNCED');
    expect(agent.userId).toBe(userAId);

    // Verify unmistakable mock identifier namespace (REQ-ARCH-03)
    expect(agent.providerAgentId).toMatch(/^agent_mock_/);

    createdAgentId = agent.id;

    // Verify record in PostgreSQL database
    const dbRecord = await prisma.agent.findUnique({
      where: { id: createdAgentId },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.name).toBe('Sales Concierge Alpha');
    expect(dbRecord?.userId).toBe(userAId);
  });

  it('GET /api/agents should list agents for the authenticated user with search support', async () => {
    // List all
    const res = await request(app).get('/api/agents').set('Cookie', userACookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agents).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.agents.some((a: { id: string }) => a.id === createdAgentId)).toBe(true);

    // Search matching
    const searchMatchRes = await request(app)
      .get('/api/agents?search=Concierge')
      .set('Cookie', userACookie);
    expect(searchMatchRes.status).toBe(200);
    expect(searchMatchRes.body.data.agents.length).toBeGreaterThanOrEqual(1);

    // Search not matching
    const searchNoMatchRes = await request(app)
      .get('/api/agents?search=NonExistentQueryXYZ')
      .set('Cookie', userACookie);
    expect(searchNoMatchRes.status).toBe(200);
    expect(searchNoMatchRes.body.data.agents.length).toBe(0);
  });

  it('GET /api/agents/:id should return agent details for owner', async () => {
    const res = await request(app)
      .get(`/api/agents/${createdAgentId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent.id).toBe(createdAgentId);
    expect(res.body.data.agent.name).toBe('Sales Concierge Alpha');
  });

  it('GET /api/agents/:id should return 404 for non-existent agent ID', async () => {
    const res = await request(app)
      .get('/api/agents/non_existent_cuid_12345')
      .set('Cookie', userACookie);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('ENFORCE MULTI-TENANT BOUNDARY: User B cannot view, edit, or delete User A agent', async () => {
    // 1. User B tries to view User A's agent -> 404
    const getRes = await request(app)
      .get(`/api/agents/${createdAgentId}`)
      .set('Cookie', userBCookie);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe('AGENT_NOT_FOUND');

    // 2. User B tries to edit User A's agent -> 404
    const putRes = await request(app)
      .put(`/api/agents/${createdAgentId}`)
      .set('Cookie', userBCookie)
      .send({
        name: 'Hacked By Bob',
      });
    expect(putRes.status).toBe(404);

    // Verify name was NOT modified in database
    const dbRecord = await prisma.agent.findUnique({
      where: { id: createdAgentId },
    });
    expect(dbRecord?.name).toBe('Sales Concierge Alpha');

    // 3. User B tries to delete User A's agent -> 404
    const delRes = await request(app)
      .delete(`/api/agents/${createdAgentId}`)
      .set('Cookie', userBCookie);
    expect(delRes.status).toBe(404);

    // 4. User B listing agents does not leak User A's agent
    const listRes = await request(app).get('/api/agents').set('Cookie', userBCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.agents.some((a: { id: string }) => a.id === createdAgentId)).toBe(false);
  });

  it('PUT /api/agents/:id should allow owner to update agent details', async () => {
    const res = await request(app)
      .put(`/api/agents/${createdAgentId}`)
      .set('Cookie', userACookie)
      .send({
        name: 'Sales Concierge Pro',
        responsiveness: 1.2,
        systemPrompt: 'Updated prompt instructions for pro agent.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent.name).toBe('Sales Concierge Pro');
    expect(res.body.data.agent.responsiveness).toBe(1.2);
    expect(res.body.data.agent.systemPrompt).toBe('Updated prompt instructions for pro agent.');

    // Verify persistence in PostgreSQL
    const dbRecord = await prisma.agent.findUnique({
      where: { id: createdAgentId },
    });
    expect(dbRecord?.name).toBe('Sales Concierge Pro');
    expect(dbRecord?.responsiveness).toBe(1.2);
  });

  it('DELETE /api/agents/:id should allow owner to delete agent and remove from database', async () => {
    const res = await request(app)
      .delete(`/api/agents/${createdAgentId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('deleted successfully');

    // Verify removed from database
    const dbRecord = await prisma.agent.findUnique({
      where: { id: createdAgentId },
    });
    expect(dbRecord).toBeNull();

    // Subsequent GET returns 404
    const getRes = await request(app)
      .get(`/api/agents/${createdAgentId}`)
      .set('Cookie', userACookie);
    expect(getRes.status).toBe(404);
  });
});
