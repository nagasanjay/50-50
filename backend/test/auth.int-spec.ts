import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, truncateAll } from './test-app.util';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and returns an access token plus a refresh cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'alice@example.com',
      password: 'password123',
      name: 'Alice',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(String), email: 'alice@example.com', name: 'Alice' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/refresh_token=/);
  });

  it('rejects registering the same email twice', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'bob@example.com',
      password: 'password123',
      name: 'Bob',
    });

    const res = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'bob@example.com',
      password: 'password123',
      name: 'Bob Again',
    });

    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects incorrect ones', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'carol@example.com',
      password: 'correct-password',
      name: 'Carol',
    });

    const good = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'carol@example.com',
      password: 'correct-password',
    });
    expect(good.status).toBe(200);
    expect(good.body.accessToken).toEqual(expect.any(String));

    const bad = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'carol@example.com',
      password: 'wrong-password',
    });
    expect(bad.status).toBe(401);
  });

  it('rotates the refresh token and issues a new access token on /auth/refresh', async () => {
    const registerRes = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'dave@example.com',
      password: 'password123',
      name: 'Dave',
    });
    const cookie = registerRes.headers['set-cookie'][0];

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    expect(refreshRes.body.accessToken).not.toBe(registerRes.body.accessToken);

    // the old refresh token cookie must now be rejected (rotation)
    const reuseRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie);
    expect(reuseRes.status).toBe(401);
  });

  it('rejects an unauthenticated request to a protected route', async () => {
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('logs out and revokes the refresh token', async () => {
    const registerRes = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'erin@example.com',
      password: 'password123',
      name: 'Erin',
    });
    const cookie = registerRes.headers['set-cookie'][0];
    const accessToken = registerRes.body.accessToken;

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshAfterLogout.status).toBe(401);
  });
});
