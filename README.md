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

1. **One-time shared Postgres setup** — provision a single Postgres instance on the Coolify host (via Coolify's native "Databases" resource, see `backend/.env.example` for the expected `DATABASE_URL` shape), then create a dedicated database + user for this app. Connect as the Postgres superuser (via Coolify's terminal for the resource, or `ssh` + `docker exec -it <postgres-container> psql -U <superuser> -d postgres`) and run:
   ```sql
   CREATE DATABASE fifty_fifty;
   CREATE USER fifty_fifty_app WITH PASSWORD '<strong-password-using-only-letters-and-digits>';
   GRANT ALL PRIVILEGES ON DATABASE fifty_fifty TO fifty_fifty_app;
   ```
   Then **reconnect to the `fifty_fifty` database specifically** (`\c fifty_fifty`, or a fresh `psql -d fifty_fifty`) and run one more grant — Postgres 15+ no longer gives new users `CREATE` on the `public` schema by default, so without this, `prisma migrate deploy` fails with `permission denied for schema public`:
   ```sql
   GRANT ALL ON SCHEMA public TO fifty_fifty_app;
   ```
   Keep the password alphanumeric-only — special characters (`@ : / # ? *` etc.) must be percent-encoded in the connection URL or Prisma will fail to parse the port (`P1013`).
2. In Coolify, add this repo as a **Docker Compose** resource pointing at the root `docker-compose.yml`.
3. Set the following environment variables in Coolify's app environment (not committed to git): `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
   - **If the Postgres resource and this app resource are in the same Coolify Project + Environment**, use the internal hostname Coolify shows on the Postgres resource's page (its "Internal URL"): `postgresql://fifty_fifty_app:<password>@<internal-host>:5432/fifty_fifty?schema=public`.
   - **If they're in different Projects/Environments** (e.g. you're keeping Postgres as infra shared across multiple app projects), Coolify's internal Docker network won't bridge them, and the internal hostname won't resolve from this app's container. Use the server's **private IP** instead (Coolify → Servers → your server; it's the one that isn't a `.1` gateway address) together with whatever host port Postgres is published on: `postgresql://fifty_fifty_app:<password>@<server-private-ip>:5432/fifty_fifty?schema=public`. This requires "public access" to be enabled on the Postgres resource (so it actually binds to the host's network interface) — but do **not** open that port in OCI's Security List, since traffic to the private IP never needs to leave the VM, so it stays unreachable from the internet either way. Never use `127.0.0.1` here — inside the app's own container, that means "this container," not the host or the database.
4. Deploy. The backend runs `prisma migrate deploy` on container start before serving traffic — check its logs on first deploy to confirm the migration applied cleanly.

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
