import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, truncateAll } from './test-app.util';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Users (integration)', () => {
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

  it('returns the current user profile', async () => {
    const registerRes = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'profile@example.com',
      password: 'password123',
      name: 'Profile Person',
    });

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({
      id: registerRes.body.user.id,
      email: 'profile@example.com',
      name: 'Profile Person',
    });
  });

  it('updates the current user name', async () => {
    const registerRes = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'rename@example.com',
      password: 'password123',
      name: 'Old Name',
    });

    const updateRes = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .send({ name: 'New Name' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('New Name');

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`);
    expect(meRes.body.name).toBe('New Name');
  });
});
