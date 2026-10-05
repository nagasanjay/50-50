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

  it('soft-deletes a settlement: it drops out of balances and the list, but the activity entry stays and is marked deleted', async () => {
    const alice = await registerUser(app, 'alice-settle4@example.com', 'Alice');
    const bob = await registerUser(app, 'bob-settle4@example.com', 'Bob');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });

    const settlementRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/settlements`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ fromUserId: bob.id, toUserId: alice.id, amountCents: 100, note: 'lunch' });
    const settlementId = settlementRes.body.id as string;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/groups/${groupRes.body.id}/settlements/${settlementId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/settlements`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(listRes.body).toHaveLength(0);

    const balances = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/balances`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(balances.body.balances.every((b: { netCents: number }) => b.netCents === 0)).toBe(true);

    const activity = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/activity`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    const entry = activity.body.find(
      (a: { type: string; metadata: { settlementId: string } }) =>
        a.type === 'SETTLEMENT_CREATED' && a.metadata.settlementId === settlementId,
    );
    expect(entry.metadata.deleted).toBe(true);
    expect(entry.metadata.note).toBe('lunch');
  });

  it('404s when deleting a settlement from another group', async () => {
    const alice = await registerUser(app, 'alice-settle5@example.com', 'Alice');
    const bob = await registerUser(app, 'bob-settle5@example.com', 'Bob');
    const group1 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group1' });
    const group2 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group2' });
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: group1.body.inviteCode });

    const settlementRes = await request(app.getHttpServer())
      .post(`/groups/${group1.body.id}/settlements`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ fromUserId: bob.id, toUserId: alice.id, amountCents: 100 });

    const res = await request(app.getHttpServer())
      .delete(`/groups/${group2.body.id}/settlements/${settlementRes.body.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(res.status).toBe(404);
  });
});
