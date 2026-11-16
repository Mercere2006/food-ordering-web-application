# Database migrations

The instructor's MySQL database is shared with other students. The existing
`013` tables and their foreign keys were created directly in that database.
The `0_baseline_013` migration records their structure for a new, isolated
database; it does not contain the existing menu data.

Do not run `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`,
or `prisma migrate resolve` against the shared database. Prisma compares the
entire database, including other students' tables, and uses a shared
`_prisma_migrations` table. The current shared database has not been baselined
in Prisma's migration history. Plan future changes as targeted SQL for the
`013` tables, or use an isolated database with its own migration history.

## Testing order creation

`npm run test:integration` runs the order flow against a temporary database on
a local MySQL server. Set `ORDER_TEST_ADMIN_URL` to a local account permitted
to create and drop databases, for example in PowerShell:

```powershell
$env:ORDER_TEST_ADMIN_URL='mysql://USER:PASSWORD@127.0.0.1:3306'
npm run test:integration
```

The test accepts localhost addresses only. It creates a database with a random
`codex_order_test_` name and drops that database after the test. Use the same
URL encoding rules for credentials as for `DATABASE_URL`.
