## Online Zakat Management System – Ops Runbook

### 1. Environment variables

Create a `.env` file in the project root (same folder as `package.json`) with:

```bash
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/zakat_mgmt"
JWT_SECRET="a-long-random-secret-string"
NISAB_VALUE="1000" # or whatever value you want as default
BOOTSTRAP_ADMIN_NAME="System Admin"
BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
BOOTSTRAP_ADMIN_PASSWORD="ChangeMe123!"
BOOTSTRAP_ACCOUNTANT_NAME="System Accountant"
BOOTSTRAP_ACCOUNTANT_EMAIL="accountant@example.com"
BOOTSTRAP_ACCOUNTANT_PASSWORD="ChangeMe123!"
```

Adjust DB name / user / password to match your local MySQL.

### 2. Database bootstrap (MySQL + Beekeeper Studio)

You have two options; with Prisma migrations or raw SQL.

#### Option A: Use Prisma migrations (recommended for dev)

1. Create an empty database in MySQL, e.g. `zakat_mgmt`.
2. Ensure `DATABASE_URL` in `.env` points to that DB.
3. From the project root:

```bash
npx prisma migrate dev --name init
npm run db:seed
```

This will:
- Create all tables defined in `prisma/schema.prisma`
- Seed roles, permissions, and an initial `settings` row for `nisab_value`

#### Option B: Use raw SQL (e.g. via Beekeeper)

1. Create an empty database in MySQL, e.g. `zakat_mgmt`.
2. Open Beekeeper Studio, connect to your MySQL server, select the DB.
3. Open `db/schema.sql` and run it against the DB.
4. Once tables are created, you can still run the Prisma seed to populate RBAC + nisab:

```bash
npx prisma generate
npm run db:seed
```

### 3. Bootstrapping Admin and Accountant users

1. Set these optional vars in `.env`:

```bash
BOOTSTRAP_ADMIN_NAME="System Admin"
BOOTSTRAP_ADMIN_EMAIL="admin@example.com"
BOOTSTRAP_ADMIN_PASSWORD="ChangeMe123!"
BOOTSTRAP_ACCOUNTANT_NAME="System Accountant"
BOOTSTRAP_ACCOUNTANT_EMAIL="accountant@example.com"
BOOTSTRAP_ACCOUNTANT_PASSWORD="ChangeMe123!"
```

2. Run seed:

```bash
npm run db:seed
```

3. Start app and sign in:

```bash
npm run dev
```

4. Log in at `http://localhost:3000/login`:
   - Admin account redirects to `/admin`
   - Accountant account redirects to `/accountant`

5. Donor registration remains at `/register` (donor only). After you are inside Admin, open `Admin > Users` and change any user role to `ADMIN`, `ACCOUNTANT`, or `DONOR`.

### 4. Basic commands

- **Dev server**: `npm run dev`
- **Typecheck**: `npx tsc --noEmit`
- **Lint**: `npm run lint`
- **Run migrations in prod**: `npm run db:migrate`
- **Re-run seed (safe / idempotent)**: `npm run db:seed`

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

