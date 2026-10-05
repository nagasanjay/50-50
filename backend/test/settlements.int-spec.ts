import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, truncateAll } from './test-app.util';
import { PrismaService } from '../src/prisma/prisma.service';

async function registerUser(app: INestApplication, email: string, name: string) {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'password123', name });
  return { id: res.body.user.id as string, accessToken: res.body.accessToken as string };
}

describe('Settlements (integration)', () => {
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

  it('rejects a settlement from a user to themselves', async () => {
    const alice = await registerUser(app, 'alice-settle@example.com', 'Alice');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/settlements`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ fromUserId: alice.id, toUserId: alice.id, amountCents: 100 });

    expect(res.status).toBe(400);
  });

  it('rejects a settlement involving a non-member', async () => {
    const alice = await registerUser(app, 'alice-settle2@example.com', 'Alice');
    const outsider = await registerUser(app, 'outsider-settle@example.com', 'Outsider');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/settlements`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ fromUserId: alice.id, toUserId: outsider.id, amountCents: 100 });

    expect(res.status).toBe(404);
  });

  it('lists settlement history for a group', async () => {
    const alice = await registerUser(app, 'alice-settle3@example.com', 'Alice');
    const bob = await registerUser(app, 'bob-settle3@example.com', 'Bob');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });

    await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/settlements`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ fromUserId: bob.id, toUserId: alice.id, amountCents: 100, note: 'lunch' });

    const listRes = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/settlements`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].note).toBe('lunch');
  });
});
