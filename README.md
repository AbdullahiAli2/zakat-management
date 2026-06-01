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

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [XAMPP](https://www.apachefriends.org/) — start **MySQL**

### 2. Create an empty database

In phpMyAdmin or MySQL, create a **new empty** database (do not import SQL files):

```sql
CREATE DATABASE zakat_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`npm run setup` will create all tables from the single migration in the repo.

### 3. Create `.env`

**Without PowerShell:** In File Explorer, copy `.env.example`, paste in the same folder, rename the copy to `.env`.

**Or in terminal:** `copy .env.example .env` (Windows) / `cp .env.example .env` (Mac/Linux)

Open `.env` and update:

| Variable | What to set |
|----------|-------------|
| `DATABASE_URL` | Your MySQL user, password, and database name (default XAMPP: `root` with no password) |
| `JWT_SECRET` | See step below — one npm command |
| `BOOTSTRAP_ADMIN_*` | Superuser name, email, and password for first login (you can keep the examples or change them) |

**JWT_SECRET (easy way — no PowerShell):**

```bash
npm run jwt:secret
```

The terminal prints a line like `JWT_SECRET="abc123..."`. **Copy that whole line** into your `.env` file (replace the placeholder).

For local class work only, you may instead type any long sentence you make up (40+ characters), for example: `MyZakatProjectSecret2026StudentName` — do not use this in real production.

### 4. Install and prepare database

```bash
npm install
npm run setup
```

- `npm install` — installs packages and generates Prisma client (automatic)
- `npm run setup` — applies **one** fresh migration (all tables), then seeds permissions, nisab, and superuser

You should see: `1 migration found` → `Applying migration 20260601000000_init`.

### 5. Run the app

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
| Migrate error `P3015` | Delete empty folders under `prisma/migrations/` (no `migration.sql`) |
| Migrate error `P3018` or `P3009` (failed migration) | `npm run db:reset-local` then `npm run setup` |
| Old database missing columns | `npm run db:repair` (only if instructor says so) |

**If `npm run setup` failed halfway**, reset the database (local dev only), then setup again:

```bash
npm run db:reset-local
npm run setup
```

Or in phpMyAdmin: `DROP DATABASE` your DB name, `CREATE DATABASE` with `utf8mb4_unicode_ci`, then `npm run setup`.

Advanced commands (optional): `npm run db:migrate`, `npm run db:seed`, `npm run db:reset-local`

More detail: [OPS.md](./OPS.md)

## Default URL

http://localhost:3000
