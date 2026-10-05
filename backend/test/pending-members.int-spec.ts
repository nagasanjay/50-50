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

describe('Pending (unregistered) group members (integration)', () => {
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

  it('adds a pending member who can immediately be split into an expense', async () => {
    const owner = await registerUser(app, 'owner@pending.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Flatmates' });
    const groupId = groupRes.body.id as string;

    const addRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'Friend@Example.com', name: 'Friend' });
    expect(addRes.status).toBe(201);
    expect(addRes.body.user.pending).toBe(true);
    const pendingUserId = addRes.body.userId as string;

    const members = await request(app.getHttpServer())
      .get(`/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body.map((m: { userId: string }) => m.userId)).toContain(pendingUserId);
    expect(members.body.find((m: { userId: string }) => m.userId === pendingUserId).user.pending).toBe(
      true,
    );

    const expenseRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        description: 'Groceries',
        amountCents: 1000,
        splitType: 'EQUAL',
        paidById: owner.id,
        participants: { userIds: [owner.id, pendingUserId] },
      });
    expect(expenseRes.status).toBe(201);

    const balances = await request(app.getHttpServer())
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const pendingBalance = balances.body.balances.find(
      (b: { userId: string }) => b.userId === pendingUserId,
    );
    expect(pendingBalance.netCents).toBe(-500);
  });

  it('claims the pending user record (same id) when that email registers', async () => {
    const owner = await registerUser(app, 'owner2@pending.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Flatmates' });
    const groupId = groupRes.body.id as string;

    const addRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'friend2@example.com', name: 'Friend' });
    const pendingUserId = addRes.body.userId as string;

    await request(app.getHttpServer())
      .post(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        description: 'Groceries',
        amountCents: 1000,
        splitType: 'EQUAL',
        paidById: owner.id,
        participants: { userIds: [owner.id, pendingUserId] },
      });

    const friend = await registerUser(app, 'friend2@example.com', 'Friend Actual Name');
    expect(friend.id).toBe(pendingUserId);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'friend2@example.com', password: 'password123' });
    expect(login.status).toBe(200);

    const balances = await request(app.getHttpServer())
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${friend.accessToken}`);
    const friendBalance = balances.body.balances.find((b: { userId: string }) => b.userId === friend.id);
    expect(friendBalance.netCents).toBe(-500);
  });

  it('rejects logging in to a pending account before it registers a password', async () => {
    const owner = await registerUser(app, 'owner3@pending.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });

    await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'nopass@example.com', name: 'No Pass' });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nopass@example.com', password: 'anything' });
    expect(login.status).toBe(401);
  });

  it('rejects adding an email that is already a member', async () => {
    const owner = await registerUser(app, 'owner4@pending.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'owner4@pending.com', name: 'Owner' });

    expect(res.status).toBe(409);
  });

  it('shares one pending user across groups and rejects a duplicate add in the same group', async () => {
    const owner1 = await registerUser(app, 'owner5a@pending.com', 'Owner1');
    const owner2 = await registerUser(app, 'owner5b@pending.com', 'Owner2');
    const group1 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner1.accessToken}`)
      .send({ name: 'Group1' });
    const group2 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner2.accessToken}`)
      .send({ name: 'Group2' });

    const add1 = await request(app.getHttpServer())
      .post(`/groups/${group1.body.id}/members`)
      .set('Authorization', `Bearer ${owner1.accessToken}`)
      .send({ email: 'shared@example.com', name: 'Shared' });
    const add2 = await request(app.getHttpServer())
      .post(`/groups/${group2.body.id}/members`)
      .set('Authorization', `Bearer ${owner2.accessToken}`)
      .send({ email: 'shared@example.com', name: 'Shared' });

    expect(add1.body.userId).toBe(add2.body.userId);

    const dupe = await request(app.getHttpServer())
      .post(`/groups/${group1.body.id}/members`)
      .set('Authorization', `Bearer ${owner1.accessToken}`)
      .send({ email: 'shared@example.com', name: 'Shared' });
    expect(dupe.status).toBe(409);
  });

  it('removes a pending member who has no expense history', async () => {
    const owner = await registerUser(app, 'owner6@pending.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });

    const addRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'removeme@example.com', name: 'Remove Me' });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/groups/${groupRes.body.id}/members/${addRes.body.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const members = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body.map((m: { userId: string }) => m.userId)).not.toContain(addRes.body.userId);
  });

  it('refuses to remove a member who has already registered an account', async () => {
    const owner = await registerUser(app, 'owner6b@pending.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });
    const other = await registerUser(app, 'other6b@pending.com', 'Other');
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/groups/${groupRes.body.id}/members/${other.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleteRes.status).toBe(409);
  });

  it('refuses to remove a pending member who already has expense history', async () => {
    const owner = await registerUser(app, 'owner7@pending.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });

    const addRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'busy@example.com', name: 'Busy' });

    await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/expenses`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        description: 'Dinner',
        amountCents: 2000,
        splitType: 'EQUAL',
        paidById: owner.id,
        participants: { userIds: [owner.id, addRes.body.userId] },
      });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/groups/${groupRes.body.id}/members/${addRes.body.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleteRes.status).toBe(409);
  });

  it('404s when removing a member that does not belong to the group', async () => {
    const owner = await registerUser(app, 'owner8@pending.com', 'Owner');
    const group1 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group1' });
    const group2 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group2' });

    const addRes = await request(app.getHttpServer())
      .post(`/groups/${group1.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'x@example.com', name: 'X' });

    const res = await request(app.getHttpServer())
      .delete(`/groups/${group2.body.id}/members/${addRes.body.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(404);
  });
});
