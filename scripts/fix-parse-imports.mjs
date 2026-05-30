import fs from "fs";
import path from "path";

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === "route.ts") out.push(p);
  }
  return out;
}

for (const file of walk("app/api")) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("isZodError") || src.includes("@/lib/parse-request")) continue;
  const lines = src.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, 'import { isZodError, zodErrorBody } from "@/lib/parse-request";');
  fs.writeFileSync(file, lines.join("\n"));
  console.log("fixed import:", file);
}
