# 50-50 backend

NestJS + Prisma (Postgres) API for the 50-50 expense-splitting app.

## Development

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a local/dev Postgres
npx prisma migrate dev
npm run start:dev
```

## Testing

Unit tests cover pure logic only (`split.util.ts`, `balances.util.ts`) with no mocking:

```bash
npm test             # unit tests
npm run test:cov     # unit tests + coverage (threshold: 95% statements/functions/lines, 90% branches)
```

Integration tests exercise every controller/service/guard against a **real** Postgres database (no mocked Prisma client) via `supertest`:

```bash
docker compose -f docker-compose.test.yml up -d
npx prisma migrate deploy  # or: DATABASE_URL=postgresql://postgres:postgres@localhost:55432/fifty_fifty_test npx prisma migrate deploy
npm run test:int           # integration tests
npm run test:int -- --coverage  # + coverage (threshold: 80% statements/functions/lines, 70% branches)
docker compose -f docker-compose.test.yml down
```
