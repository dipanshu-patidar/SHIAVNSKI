import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();

describe('Authentication API Integration Tests', () => {
  const testEmail = `test_${Date.now()}@shiavnski.com`;
  const testPassword = 'Password123!';
  const testFullName = 'Deepak Sharma';

  let authCookie: string;

  beforeAll(async () => {
    // Clean up test user if previously exists
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  afterAll(async () => {
    // Clean up created test user
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });

  it('POST /api/auth/register should successfully create a user and return HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: testFullName,
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.fullName).toBe(testFullName);
    expect(res.body.data.user.role).toBe('USER');
    // Ensure password hash is NEVER exposed
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();

    // Verify Set-Cookie header contains HttpOnly auth_token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    authCookie = Array.isArray(cookies) ? cookies[0] : (cookies as unknown as string);
    expect(authCookie).toContain('auth_token=');
    expect(authCookie.toLowerCase()).toContain('httponly');

    // Verify in database that password was actually hashed with bcrypt
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    expect(dbUser).toBeDefined();
    expect(dbUser!.passwordHash).not.toBe(testPassword);
    expect(dbUser!.passwordHash.startsWith('$2')).toBe(true);
  });

  it('POST /api/auth/register should reject duplicate email with 409 DUPLICATE_EMAIL', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Another Name',
        email: testEmail, // same email
        password: 'Password999!',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('POST /api/auth/register should fail validation if password is weak or missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Test User',
        email: 'invalid-email-format',
        password: '123',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/auth/login should fail with invalid credentials (wrong password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/auth/login should fail with non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'does_not_exist@shiavnski.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/auth/login should authenticate successfully with valid credentials and set cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    authCookie = Array.isArray(cookies) ? cookies[0] : (cookies as unknown as string);
    expect(authCookie).toContain('auth_token=');
  });

  it('GET /api/auth/me should return authenticated user details when auth cookie is passed', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.fullName).toBe(testFullName);
  });

  it('GET /api/auth/me should reject unauthenticated request with 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/auth/logout should clear the auth cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Logged out');

    // Cookie should be cleared (expired in past or empty)
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const clearCookieStr = Array.isArray(cookies) ? cookies[0] : (cookies as unknown as string);
    expect(clearCookieStr).toContain('auth_token=;');
  });
});
