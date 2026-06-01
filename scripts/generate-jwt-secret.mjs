import { randomBytes } from "node:crypto";

const secret = randomBytes(48).toString("hex");

console.log("");
console.log("Copy this into your .env file as JWT_SECRET:");
console.log("");
console.log(`JWT_SECRET="${secret}"`);
console.log("");
console.log("(Keep it private. Do not share or upload to GitHub.)");
console.log("");
