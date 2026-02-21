# Elixopay Backend Deployment Guide

This guide covers the deployment process for the Elixopay backend service.

## Prerequisites

- Node.js (v18+)
- PostgreSQL Database
- npm or yarn

## 1. Environment Setup

Create a `.env` file in the root of the backend directory. You can copy `.env.example` as a template.

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` for live environment |
| `PORT` | content api port (default: 3000) |
| `DB_HOST` | Database hostname |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name |
| `DB_PORT` | Database port (default: 5432) |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `FRONTEND_URL` | URL of the frontend application |

## 2. Database Migration

Ensure your database is up to date.

```bash
# Run generic setup if available (or use specific scripts)
node scripts/fix_db_name.js
```

## 3. Build & Run

### For Production

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Start the server:
   ```bash
   npm start
   ```

### For Development

```bash
npm run dev
```

## 4. Verification

After deployment, verify the health of the service:

```bash
curl https://<your-domain>/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "..."
}
```

## Cloud Provider Specifics

### Railway

Refer to `DEPLOY_CHECKLIST.md` for detailed Railway deployment instructions, including variable configuration and troubleshooting.
