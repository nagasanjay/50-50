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

describe('Groups (integration)', () => {
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

  it('rejects joining with an invalid invite code', async () => {
    const user = await registerUser(app, 'joiner@example.com', 'Joiner');

    const res = await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ inviteCode: 'does-not-exist' });

    expect(res.status).toBe(404);
  });

  it('is idempotent when a member joins a group they already belong to', async () => {
    const owner = await registerUser(app, 'owner@example.com', 'Owner');

    const createRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Idempotent Group' });

    const firstJoin = await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ inviteCode: createRes.body.inviteCode });
    expect(firstJoin.status).toBe(201);

    const members = await request(app.getHttpServer())
      .get(`/groups/${createRes.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.body).toHaveLength(1);
  });

  it('returns 404 for a group that does not exist', async () => {
    const user = await registerUser(app, 'nogroup@example.com', 'NoGroup');

    const res = await request(app.getHttpServer())
      .get('/groups/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('lists only the groups the current user belongs to', async () => {
    const alice = await registerUser(app, 'alice-list@example.com', 'Alice');
    const bob = await registerUser(app, 'bob-list@example.com', 'Bob');

    await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ name: "Alice's Group" });
    await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ name: "Bob's Group" });

    const aliceGroups = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${alice.accessToken}`);

    expect(aliceGroups.body).toHaveLength(1);
    expect(aliceGroups.body[0].name).toBe("Alice's Group");
  });
});
