## Online Zakat Management System – Ops Runbook

### 1. Environment variables

Copy `.env.example` to `.env` in the project root (same folder as `package.json`), then adjust:

```bash
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/zakat_db"
JWT_SECRET="your-own-long-random-secret"
BOOTSTRAP_ADMIN_NAME="Super Admin"
BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
BOOTSTRAP_ADMIN_PASSWORD="ChangeMe123!"
```

Adjust DB name / user / password to match your local MySQL.

**JWT secret:** run `npm run jwt:secret` and paste the printed line into `.env` as `JWT_SECRET`.

### 2. Database bootstrap (MySQL + Beekeeper Studio)

You have two options; with Prisma migrations or raw SQL.

#### Option A: Use Prisma migrations (recommended for dev)

1. Create an empty database in MySQL, e.g. `zakat_mgmt`.
2. Ensure `DATABASE_URL` in `.env` points to that DB.
3. From the project root:

```bash
npm install
npm run setup
```

Do **not** run `npx prisma migrate dev` on a Git clone (students use the committed migration only).

The repo ships **one** migration: `20260601000000_init`. `npm run setup` applies it on an empty database, then seeds permissions, nisab, and the SUPERUSER (when `BOOTSTRAP_ADMIN_*` is set in `.env`).

#### Option B: Use raw SQL (e.g. via Beekeeper)

1. Create an empty database in MySQL, e.g. `zakat_mgmt`.
2. Open Beekeeper Studio, connect to your MySQL server, select the DB.
3. Open `db/schema.sql` and run it against the DB.
4. Once tables are created, you can still run the Prisma seed to populate RBAC + nisab:

```bash
npm install
npm run setup
```

### 3. Bootstrapping the superuser

1. Set `BOOTSTRAP_ADMIN_*` in `.env` (see `.env.example`).

2. Run seed:

```bash
npm run db:seed
```

3. Start app and sign in:

```bash
npm run dev
```

4. Log in at `http://localhost:3000/login` with the superuser email/password.

5. **Donors** register at `/register`. **Admins** are created or promoted in `Admin > Users` by the superuser.

### 4. Basic commands

- **Dev server**: `npm run dev`
- **Typecheck**: `npx tsc --noEmit`
- **Lint**: `npm run lint`
- **Fresh clone setup**: `npm install` then `npm run setup`
- **Re-run seed only**: `npm run db:seed`
- **Migrations only**: `npm run db:migrate`
- **Repair old DB columns**: `npm run db:repair`

### 5. Verifying tables in Beekeeper Studio

After running migrations or `db/schema.sql`, you should see (among others):

- `roles`, `permissions`, `role_permissions`
- `users`, `accounts`
- `transactions`, `zakat_payments`
- `audit_trails`, `error_logs`
- `notifications`, `settings`

You can inspect balances and zakat payments by looking at:

- `accounts.balance`
- `transactions` rows per `from_account_id` / `to_account_id`
- `zakat_payments` linked by `transaction_id`

### 6. Profile page (avatar + password)

Profile page is available for all roles:
- `/admin/profile`
- `/accountant/profile`
- `/donor/profile`

If your DB was created before this feature, add `avatar_url` to `users`:

```sql
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL;
```

Or run a Prisma migration in dev:

```bash
npx prisma migrate dev --name add-user-avatar
```

