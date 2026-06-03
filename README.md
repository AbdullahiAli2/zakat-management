# Online Zakat Payment Management System

A web-based Zakat Management System developed using Next.js, Node.js, and MySQL.

## Features

- User Authentication
- Zakat Payment Management
- Beneficiary Management
- Reports Dashboard
- Admin Panel

## Technologies Used

- Next.js
- React.js
- Node.js
- MySQL
- Prisma ORM
- Tailwind CSS

## Student setup (after cloning from GitHub)

```bash
git clone https://github.com/AbdullahiAli2/zakat-management.git
cd zakat-management
npm install
npm run env:init
npm run jwt:secret
# paste JWT_SECRET into .env, fix DATABASE_URL if needed
npm run setup
npm run dev
```

Log in at http://localhost:3000 with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` from `.env`.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [XAMPP](https://www.apachefriends.org/) — start **MySQL**

### 2. Create an empty database

In phpMyAdmin or MySQL, create a **new empty** database (do not import SQL files):

```sql
CREATE DATABASE zakat_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`npm run setup` will create all tables from the single migration in the repo.

### 3. Install packages

```bash
npm install
```

### 4. Create `.env` from `.env.example`

```bash
npm run env:init
```

Or manually: `copy .env.example .env` (Windows) / `cp .env.example .env` (Mac/Linux)

Open `.env` and set:

| Variable | What to set |
|----------|-------------|
| `DATABASE_URL` | MySQL user, password, database (XAMPP default: `root`, no password, `zakat_db`) |
| `JWT_SECRET` | From `npm run jwt:secret` (see below) |
| `BOOTSTRAP_ADMIN_*` | Superuser name, email, password for first login |

**Generate JWT_SECRET:**

```bash
npm run jwt:secret
```

Copy the printed line `JWT_SECRET="..."` into `.env` (replace the placeholder).

### 5. Prepare database (one command)

```bash
npm run setup
```

This runs:

- `prisma migrate deploy` — creates all tables (one migration)
- `prisma db seed` — permissions, nisab, **chart of accounts & zakat wallet**, superuser

You should see: `Applying migration 20260601000000_init` and `[seed] Chart of accounts and system wallets ready.`

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.

Donors register at `/register`. Additional admins are created in **Admin → Users**.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Cannot connect to database | MySQL running; database exists; `DATABASE_URL` correct |
| Seed OK but cannot log in | Set `BOOTSTRAP_ADMIN_*` in `.env`, then `npm run setup` again |
| Approve zakat fails / wallet error | Run `npm run setup` or `npm run db:repair` (creates zakat wallet) |
| Migrate error `P3015` | Delete empty folders under `prisma/migrations/` (no `migration.sql`) |
| Migrate error `P3018` or `P3009` (failed migration) | `npm run db:reset-local` then `npm run setup` |
| Old database missing columns | `npm run db:repair` (only if instructor says so) |

**If `npm run setup` failed halfway**, reset the database (local dev only), then setup again:

```bash
npm run db:reset-local
npm run setup
```

Or in phpMyAdmin: `DROP DATABASE` your DB name, `CREATE DATABASE` with `utf8mb4_unicode_ci`, then `npm run setup`.

**All setup commands (reference):**

| Command | Purpose |
|---------|---------|
| `npm run env:init` | Create `.env` from `.env.example` |
| `npm run jwt:secret` | Print a `JWT_SECRET` line for `.env` |
| `npm run setup` | Migrate + seed (main command) |
| `npm run db:migrate` | Apply migrations only |
| `npm run db:seed` | Seed only (permissions, wallets, admin) |
| `npm run db:repair` | Fix missing columns / wallets on existing DB |
| `npm run db:reset-local` | Drop & recreate DB (local dev only) |

More detail: [OPS.md](./OPS.md)

## Default URL

http://localhost:3000
