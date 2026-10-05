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

describe('Group invites (integration)', () => {
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

  it('auto-joins a new user to every group that invited their email', async () => {
    const owner = await registerUser(app, 'owner@invite.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Flatmates' });
    const groupId = groupRes.body.id as string;

    const inviteRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'Friend@Example.com', name: 'Friend' });
    expect(inviteRes.status).toBe(201);

    const listBeforeJoin = await request(app.getHttpServer())
      .get(`/groups/${groupId}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(listBeforeJoin.body).toHaveLength(1);
    expect(listBeforeJoin.body[0].email).toBe('friend@example.com');

    // The invited person registers with a differently-cased version of the same email.
    const friend = await registerUser(app, 'friend@example.com', 'Friend Actual Name');

    const members = await request(app.getHttpServer())
      .get(`/groups/${groupId}/members`)
      .set('Authorization', `Bearer ${friend.accessToken}`);
    expect(members.status).toBe(200);
    expect(members.body.map((m: { userId: string }) => m.userId)).toContain(friend.id);

    const listAfterJoin = await request(app.getHttpServer())
      .get(`/groups/${groupId}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(listAfterJoin.body).toHaveLength(0);

    const activity = await request(app.getHttpServer())
      .get(`/groups/${groupId}/activity`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(activity.body.some((a: { type: string }) => a.type === 'MEMBER_JOINED')).toBe(true);
  });

  it('joins a user to multiple groups that each invited the same email', async () => {
    const owner1 = await registerUser(app, 'owner1@invite.com', 'Owner1');
    const owner2 = await registerUser(app, 'owner2@invite.com', 'Owner2');
    const group1 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner1.accessToken}`)
      .send({ name: 'Group1' });
    const group2 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner2.accessToken}`)
      .send({ name: 'Group2' });

    await request(app.getHttpServer())
      .post(`/groups/${group1.body.id}/invites`)
      .set('Authorization', `Bearer ${owner1.accessToken}`)
      .send({ email: 'shared@example.com', name: 'Shared' });
    await request(app.getHttpServer())
      .post(`/groups/${group2.body.id}/invites`)
      .set('Authorization', `Bearer ${owner2.accessToken}`)
      .send({ email: 'shared@example.com', name: 'Shared' });

    const shared = await registerUser(app, 'shared@example.com', 'Shared Person');

    const myGroups = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${shared.accessToken}`);
    expect(myGroups.body.map((g: { id: string }) => g.id).sort()).toEqual(
      [group1.body.id, group2.body.id].sort(),
    );
  });

  it('rejects inviting an email that is already a member', async () => {
    const owner = await registerUser(app, 'owner2b@invite.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'owner2b@invite.com', name: 'Owner' });

    expect(res.status).toBe(409);
  });

  it('rejects a duplicate invite for the same email', async () => {
    const owner = await registerUser(app, 'owner3@invite.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });

    await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'dup@example.com', name: 'Dup' });

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'dup@example.com', name: 'Dup Again' });

    expect(res.status).toBe(409);
  });

  it('cancels a pending invite', async () => {
    const owner = await registerUser(app, 'owner4@invite.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group' });

    const inviteRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'cancelme@example.com', name: 'Cancel Me' });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/groups/${groupRes.body.id}/invites/${inviteRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get(`/groups/${groupRes.body.id}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('404s when canceling an invite that does not belong to the group', async () => {
    const owner = await registerUser(app, 'owner5@invite.com', 'Owner');
    const group1 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group1' });
    const group2 = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Group2' });

    const inviteRes = await request(app.getHttpServer())
      .post(`/groups/${group1.body.id}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'x@example.com', name: 'X' });

    const res = await request(app.getHttpServer())
      .delete(`/groups/${group2.body.id}/invites/${inviteRes.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(404);
  });
});
