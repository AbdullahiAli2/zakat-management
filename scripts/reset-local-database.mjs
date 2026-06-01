/**
 * Drops and recreates the MySQL database from DATABASE_URL in .env.
 * For local student setup only — fixes P3009 / half-failed migrations.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

function parseDatabaseUrl(url) {
  if (!url) throw new Error("DATABASE_URL is not set in .env");
  const match = url.match(/^mysql:\/\/([^:]*):([^@]*)@([^:/]+):(\d+)\/([^?]+)/);
  if (!match) {
    throw new Error(
      'DATABASE_URL must look like mysql://user:password@localhost:3306/db_name'
    );
  }
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: Number(port), database };
}

async function main() {
  const { user, password, host, port, database } = parseDatabaseUrl(
    process.env.DATABASE_URL
  );

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password: password || undefined,
    multipleStatements: true,
  });

  console.log(`Resetting database "${database}" on ${host}:${port}...`);
  await conn.query(
    `DROP DATABASE IF EXISTS \`${database}\`; CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await conn.end();
  console.log("Done. Run: npm run setup");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
