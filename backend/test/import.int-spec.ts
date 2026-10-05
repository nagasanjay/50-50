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

const HEADER = 'Date,Description,Category,Cost,Currency,Alice,Bob,Carol';

describe('CSV import (integration)', () => {
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

  it('previews a CSV without writing anything to the database', async () => {
    const owner = await registerUser(app, 'owner@import.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Flatmates' });

    const csv = [
      HEADER,
      '2025-01-02,Booking amount,General,10000.00,INR,-5000.00,0.00,5000.00',
      '2025-01-02,Alice paid Carol,Payment,8000.01,INR,8000.01,0.00,-8000.01',
      '2026-10-05,Total balance, , ,INR,0.00,0.00,0.00',
    ].join('\n');

    const previewRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/import/preview`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ csv });

    expect(previewRes.status).toBe(201);
    expect(previewRes.body).toEqual({
      memberNames: ['Alice', 'Bob', 'Carol'],
      expenseCount: 1,
      settlementCount: 1,
      warnings: [],
    });

    const expensesAfterPreview = await prisma.expense.count({ where: { groupId: groupRes.body.id } });
    expect(expensesAfterPreview).toBe(0);
  });

  it('commits a CSV: creates expenses/settlements with correct balances and reports warnings', async () => {
    const owner = await registerUser(app, 'owner2@import.com', 'Owner');
    const bob = await registerUser(app, 'bob2@import.com', 'Bob');
    const carol = await registerUser(app, 'carol2@import.com', 'Carol');

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Flatmates' });
    const groupId = groupRes.body.id as string;

    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });
    await request(app.getHttpServer())
      .post('/groups/join')
      .set('Authorization', `Bearer ${carol.accessToken}`)
      .send({ inviteCode: groupRes.body.inviteCode });

    const csv = [
      HEADER,
      // Alice(owner) pays 10000, split 2-way with Carol (Bob uninvolved)
      '2025-01-02,Booking amount,General,10000.00,INR,5000.00,0.00,-5000.00',
      // Carol settles her 5000 debt by paying Alice
      '2025-01-03,Carol paid Alice,Payment,5000.00,INR,-5000.00,0.00,5000.00',
      // malformed row: no identifiable payer -> should be reported as a warning, not imported
      '2025-01-04,Mystery,General,500.00,INR,0.00,0.00,0.00',
      '2026-10-05,Total balance, , ,INR,0.00,0.00,0.00',
    ].join('\n');

    const memberMap = { Alice: owner.id, Bob: bob.id, Carol: carol.id };

    const commitRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/import/commit`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ csv, memberMap });

    expect(commitRes.status).toBe(201);
    expect(commitRes.body.importedExpenses).toBe(1);
    expect(commitRes.body.importedSettlements).toBe(1);
    expect(commitRes.body.warnings).toEqual([
      expect.objectContaining({ description: 'Mystery', reason: expect.stringMatching(/no payer/i) }),
    ]);

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: { participants: true },
    });
    expect(expenses).toHaveLength(1);
    expect(expenses[0].category).toBe('General');
    expect(expenses[0].paidById).toBe(owner.id);
    const shareByUser = Object.fromEntries(expenses[0].participants.map((p) => [p.userId, p.shareCents]));
    expect(shareByUser[owner.id]).toBe(500000);
    expect(shareByUser[carol.id]).toBe(500000);
    expect(shareByUser[bob.id]).toBeUndefined();

    const settlementsInDb = await prisma.settlement.findMany({ where: { groupId } });
    expect(settlementsInDb).toHaveLength(1);
    expect(settlementsInDb[0].fromUserId).toBe(carol.id);
    expect(settlementsInDb[0].toUserId).toBe(owner.id);
    expect(settlementsInDb[0].amountCents).toBe(500000);

    const balancesRes = await request(app.getHttpServer())
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const netByUser = Object.fromEntries(
      balancesRes.body.balances.map((b: { userId: string; netCents: number }) => [b.userId, b.netCents]),
    );
    expect(netByUser[owner.id]).toBe(0);
    expect(netByUser[carol.id]).toBe(0); // Carol's debt was fully settled
  });

  it('rejects a commit when a CSV member name has no mapping', async () => {
    const owner = await registerUser(app, 'owner3@import.com', 'Owner');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Flatmates' });

    const csv = [HEADER, '2025-01-02,Lunch,General,100.00,INR,-50.00,0.00,50.00'].join('\n');

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/import/commit`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ csv, memberMap: { Alice: owner.id } });

    expect(res.status).toBe(400);
  });

  it('rejects a commit when a mapped user is not actually a member of the group', async () => {
    const owner = await registerUser(app, 'owner4@import.com', 'Owner');
    const outsider = await registerUser(app, 'outsider4@import.com', 'Outsider');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Flatmates' });

    const csv = [
      HEADER,
      '2025-01-02,Lunch,General,100.00,INR,-50.00,0.00,50.00',
    ].join('\n');

    const res = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/import/commit`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ csv, memberMap: { Alice: owner.id, Bob: owner.id, Carol: outsider.id } });

    expect(res.status).toBe(400);
  });
});
