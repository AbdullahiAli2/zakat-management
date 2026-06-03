import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const example = resolve(root, ".env.example");
const env = resolve(root, ".env");

if (existsSync(env)) {
  console.log(".env already exists — edit it if needed, then run: npm run setup");
  process.exit(0);
}

if (!existsSync(example)) {
  console.error("Missing .env.example in project root.");
  process.exit(1);
}

copyFileSync(example, env);
console.log("Created .env from .env.example");
console.log("");
console.log("Next steps:");
console.log("  1) Edit .env — set DATABASE_URL and BOOTSTRAP_ADMIN_*");
console.log("  2) npm run jwt:secret  → paste the JWT_SECRET line into .env");
console.log("  3) npm run setup");
console.log("  4) npm run dev");
