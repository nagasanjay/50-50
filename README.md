# 50-50

A lightweight, mobile-friendly, installable-PWA alternative to Splitwise. Split group expenses, track balances, and settle up.

- `backend/` — NestJS + Prisma (Postgres) API
- `frontend/` — Next.js (App Router) + Tailwind + shadcn/ui, installable as a PWA

See [backend/README.md](backend/README.md) and the `.env.example` files in each folder for local development and testing instructions.

## Architecture

- The frontend talks to the backend only through its own `/api/*` rewrite proxy (configured in `frontend/next.config.mjs`), so the browser only ever sees one origin — no CORS configuration needed, and auth cookies are same-origin.
- Auth: email/password with short-lived JWT access tokens and rotating opaque refresh tokens (httpOnly cookie).
- Money is always stored and computed in integer cents.
- Balances are computed on read from expenses/settlements, not maintained incrementally — see `backend/src/balances/balances.service.ts`.

## Deployment (Coolify on a shared OCI VM)

1. **One-time shared Postgres setup** — provision a single Postgres instance on the Coolify host (via Coolify's native "Databases" resource, see `backend/.env.example` for the expected `DATABASE_URL` shape), then create a dedicated database + user for this app:
   ```sql
   CREATE DATABASE fifty_fifty;
   CREATE USER fifty_fifty_app WITH PASSWORD '<strong-password>';
   GRANT ALL PRIVILEGES ON DATABASE fifty_fifty TO fifty_fifty_app;
   ```
2. In Coolify, add this repo as a **Docker Compose** resource pointing at the root `docker-compose.yml`.
3. Set the following environment variables in Coolify's app environment (not committed to git): `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
4. Deploy. The backend runs `prisma migrate deploy` on container start before serving traffic.

## Local development

```bash
# Backend
cd backend
npm install
cp .env.example .env   # point DATABASE_URL at a local/dev Postgres
npx prisma migrate dev
npm run start:dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

For local dev without Docker, the frontend's `/api/*` rewrite points at `http://backend:4000` (the Docker service name) — run both via `docker compose up --build` to exercise the full same-origin proxy setup, or adjust `frontend/next.config.mjs` locally if running the backend on `localhost` instead.
