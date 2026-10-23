import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('API Health & Base Routing', () => {
  it('GET /api/health returns 200 and healthy service status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.providerMode).toBeDefined();
    expect(response.body.data.service).toBe('ai-voice-agent-backend');
    expect(response.body.data.version).toBe('1.0.0');
    expect(typeof response.body.data.uptime).toBe('number');
  });

  it('GET / returns 200 and base welcome information', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('AI Voice Agent Management System API');
    expect(response.body.status).toBe('online');
  });

  it('GET /api/unknown-endpoint returns 404 with standardized error envelope', async () => {
    const response = await request(app).get('/api/unknown-endpoint');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toContain('Route GET /api/unknown-endpoint not found');
  });
});
