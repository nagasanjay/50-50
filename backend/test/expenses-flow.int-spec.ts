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

describe('Group expense lifecycle (integration)', () => {
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

  it('runs the full register -> group -> expense -> balances -> settle -> activity flow', async () => {
    const server = app.getHttpServer();

    const alice = await registerUser(app, 'alice@flow.com', 'Alice');
    const bob = await registerUser(app, 'bob@flow.com', 'Bob');

    const createGroupRes = await request(server)
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Trip to Goa' });
    expect(createGroupRes.status).toBe(201);
    const groupId = createGroupRes.body.id as string;
    const inviteCode = createGroupRes.body.inviteCode as string;

    const joinRes = await request(server)
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode });
    expect(joinRes.status).toBe(201);

    const membersRes = await request(server)
      .get(`/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(membersRes.body).toHaveLength(2);

    const expenseRes = await request(server)
      .post(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Hotel',
        amountCents: 10000,
        splitType: 'EQUAL',
        paidById: alice.id,
        participants: { userIds: [alice.id, bob.id] },
      });
    expect(expenseRes.status).toBe(201);
    const sumOfShares = expenseRes.body.participants.reduce(
      (sum: number, p: { shareCents: number }) => sum + p.shareCents,
      0,
    );
    expect(sumOfShares).toBe(10000);

    const balancesBefore = await request(server)
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(balancesBefore.status).toBe(200);
    const aliceBalanceBefore = balancesBefore.body.balances.find(
      (b: { userId: string }) => b.userId === alice.id,
    );
    const bobBalanceBefore = balancesBefore.body.balances.find(
      (b: { userId: string }) => b.userId === bob.id,
    );
    expect(aliceBalanceBefore.netCents).toBe(5000);
    expect(bobBalanceBefore.netCents).toBe(-5000);
    expect(balancesBefore.body.simplifiedTransfers).toEqual([
      { fromUserId: bob.id, toUserId: alice.id, amountCents: 5000 },
    ]);

    const settleRes = await request(server)
      .post(`/groups/${groupId}/settlements`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ fromUserId: bob.id, toUserId: alice.id, amountCents: 5000 });
    expect(settleRes.status).toBe(201);

    const balancesAfter = await request(server)
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    const aliceBalanceAfter = balancesAfter.body.balances.find(
      (b: { userId: string }) => b.userId === alice.id,
    );
    const bobBalanceAfter = balancesAfter.body.balances.find(
      (b: { userId: string }) => b.userId === bob.id,
    );
    expect(aliceBalanceAfter.netCents).toBe(0);
    expect(bobBalanceAfter.netCents).toBe(0);
    expect(balancesAfter.body.simplifiedTransfers).toEqual([]);

    const activityRes = await request(server)
      .get(`/groups/${groupId}/activity`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(activityRes.status).toBe(200);
    const types = activityRes.body.map((a: { type: string }) => a.type).reverse();
    expect(types).toEqual([
      'GROUP_CREATED',
      'MEMBER_JOINED',
      'EXPENSE_CREATED',
      'SETTLEMENT_CREATED',
    ]);
  });

  it('rejects a non-member from accessing a group', async () => {
    const alice = await registerUser(app, 'alice2@flow.com', 'Alice');
    const outsider = await registerUser(app, 'outsider@flow.com', 'Outsider');

    const createGroupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Private Group' });
    const groupId = createGroupRes.body.id as string;

    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects an expense whose split shares do not sum to the total', async () => {
    const alice = await registerUser(app, 'alice3@flow.com', 'Alice');
    const bob = await registerUser(app, 'bob3@flow.com', 'Bob');

    const createGroupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });
    const groupId = createGroupRes.body.id as string;

    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: createGroupRes.body.inviteCode });

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Broken split',
        amountCents: 1000,
        splitType: 'EXACT',
        paidById: alice.id,
        participants: {
          shares: [
            { userId: alice.id, amountCents: 400 },
            { userId: bob.id, amountCents: 400 },
          ],
        },
      });

    expect(res.status).toBe(400);
  });

  it('deletes an expense and removes it from the group list', async () => {
    const alice = await registerUser(app, 'alice4@flow.com', 'Alice');

    const createGroupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Solo Group' });
    const groupId = createGroupRes.body.id as string;

    const expenseRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Snacks',
        amountCents: 500,
        splitType: 'EQUAL',
        paidById: alice.id,
        participants: { userIds: [alice.id] },
      });
    const expenseId = expenseRes.body.id as string;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/groups/${groupId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('soft-deletes an expense: balances return to zero for every participant, editing is blocked, and the activity entry is marked deleted', async () => {
    const alice = await registerUser(app, 'alice5@flow.com', 'Alice');
    const bob = await registerUser(app, 'bob5@flow.com', 'Bob');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: 'Group' });
    const groupId = groupRes.body.id as string;
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });

    const expenseRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Dinner',
        amountCents: 1000,
        splitType: 'EQUAL',
        paidById: alice.id,
        participants: { userIds: [alice.id, bob.id] },
      });
    const expenseId = expenseRes.body.id as string;

    await request(app.getHttpServer())
      .delete(`/groups/${groupId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);

    const balances = await request(app.getHttpServer())
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(balances.body.balances.every((b: { netCents: number }) => b.netCents === 0)).toBe(true);

    const updateRes = await request(app.getHttpServer())
      .patch(`/groups/${groupId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        description: 'Dinner (edited)',
        amountCents: 2000,
        splitType: 'EQUAL',
        paidById: alice.id,
        participants: { userIds: [alice.id, bob.id] },
      });
    expect(updateRes.status).toBe(409);

    // deleting again is idempotent, not an error
    const secondDelete = await request(app.getHttpServer())
      .delete(`/groups/${groupId}/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    expect(secondDelete.status).toBe(200);

    const activity = await request(app.getHttpServer())
      .get(`/groups/${groupId}/activity`)
      .set('Authorization', `Bearer ${alice.accessToken}`);
    const createdEntry = activity.body.find(
      (a: { type: string; metadata: { expenseId: string } }) =>
        a.type === 'EXPENSE_CREATED' && a.metadata.expenseId === expenseId,
    );
    expect(createdEntry.metadata.deleted).toBe(true);
    const deletedEntries = activity.body.filter(
      (a: { type: string; metadata: { expenseId: string } }) =>
        a.type === 'EXPENSE_DELETED' && a.metadata.expenseId === expenseId,
    );
    expect(deletedEntries).toHaveLength(1);
  });
});
