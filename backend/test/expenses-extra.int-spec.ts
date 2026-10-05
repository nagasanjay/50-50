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

describe('Expenses (additional coverage, integration)', () => {
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

  it('creates a PERCENTAGE split expense via HTTP', async () => {
    const alice = await registerUser(app, 'alice-pct@example.com', 'Alice');
    const bob = await registerUser(app, 'bob-pct@example.com', 'Bob');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Taxi',
        amountCents: 1000,
        splitType: 'PERCENTAGE',
        paidById: alice.id,
        participants: {
          shares: [
            { userId: alice.id, percentage: 70 },
            { userId: bob.id, percentage: 30 },
          ],
        },
      });

    expect(res.status).toBe(201);
    const total = res.body.participants.reduce((s: number, p: { shareCents: number }) => s + p.shareCents, 0);
    expect(total).toBe(1000);
  });

  it('fetches a single expense by id and 404s for a mismatched group', async () => {
    const alice = await registerUser(app, 'alice-get@example.com', 'Alice');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });

    const expenseRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Coffee',
        amountCents: 300,
        splitType: 'EQUAL',
        paidById: alice.id,
        participants: { userIds: [alice.id] },
      });

    const getRes = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/expenses/${expenseRes.body.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.description).toBe('Coffee');

    const otherGroupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Other Group' });

    const mismatchRes = await request(app.getHttpServer())
      .get(`/groups/${otherGroupRes.body.id}/expenses/${expenseRes.body.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(mismatchRes.status).toBe(404);
  });

  it('updates an expense, replacing its participants', async () => {
    const alice = await registerUser(app, 'alice-upd@example.com', 'Alice');
    const bob = await registerUser(app, 'bob-upd@example.com', 'Bob');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });

    const expenseRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Dinner',
        amountCents: 2000,
        splitType: 'EQUAL',
        paidById: alice.id,
        participants: { userIds: [alice.id] },
      });

    const updateRes = await request(app.getHttpServer())
      .patch(`/groups/${groupRes.body.id}/expenses/${expenseRes.body.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Dinner (split with Bob)',
        amountCents: 2000,
        splitType: 'EQUAL',
        paidById: alice.id,
        participants: { userIds: [alice.id, bob.id] },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.description).toBe('Dinner (split with Bob)');
    expect(updateRes.body.participants).toHaveLength(2);
  });

  it('returns a group activity feed limited by the take query param', async () => {
    const alice = await registerUser(app, 'alice-take@example.com', 'Alice');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`/groups/${groupRes.body.id}/expenses`)
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({
          description: `Item ${i}`,
          amountCents: 100,
          splitType: 'EQUAL',
          paidById: alice.id,
          participants: { userIds: [alice.id] },
        });
    }

    const activityRes = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/activity?take=2`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(activityRes.status).toBe(200);
    expect(activityRes.body).toHaveLength(2);
  });
});
