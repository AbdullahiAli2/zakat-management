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

function ensureImport(src, importLine) {
  if (src.includes(importLine)) return src;
  const lines = src.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, importLine);
  return lines.join("\n");
}

const files = walk("app/api");
let changed = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;

  if (/safeParse|Schema\.parse|schema\.parse|\.parse\(await req\.json/.test(src)) {
    src = ensureImport(src, 'import { validationErrorBody } from "@/lib/validation-messages";');
    src = ensureImport(src, 'import { parseRequestBody, isZodError, zodErrorBody } from "@/lib/parse-request";');
  }

  src = src.replace(
    /if \(!parsed\.success\) \{\r?\n\s*return NextResponse\.json\(\r?\n\s*\{ ok: false, error: "Invalid request", details: parsed\.error\.flatten\(\) \},\r?\n\s*\{ status: 400 \},\r?\n\s*\);\r?\n\s*\}/g,
    "if (!parsed.success) {\n      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });\n    }",
  );

  src = src.replace(
    /if \(!parsed\.success\) \{\r?\n\s*return NextResponse\.json\(\r?\n\s*\{ ok: false, error: "Invalid query", details: parsed\.error\.flatten\(\) \},\r?\n\s*\{ status: 400 \},\r?\n\s*\);\r?\n\s*\}/g,
    "if (!parsed.success) {\n      return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });\n    }",
  );

  src = src.replace(
    /return NextResponse\.json\(\{ ok: false, error: "Invalid request", details: parsed\.error\.flatten\(\) \}, \{ status: 400 \}\);/g,
    "return NextResponse.json(validationErrorBody(parsed.error), { status: 400 });",
  );

  // const parsed = fooSchema.parse(await req.json());
  src = src.replace(
    /const parsed = ([a-zA-Z0-9_]+)\.parse\(await req\.json\(\)\);/g,
    "const validated = parseRequestBody($1, await req.json());\n    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });\n    const parsed = validated.data;",
  );

  src = src.replace(
    /const parsed = ([a-zA-Z0-9_]+)\.parse\(body\);/g,
    "const validated = parseRequestBody($1, body);\n    if (!validated.ok) return NextResponse.json(validated.body, { status: validated.status });\n    const parsed = validated.data;",
  );

  // catch zod in generic catch blocks - add before logError if not present
  if (src.includes("} catch (err)") && !src.includes("isZodError(err)")) {
    src = src.replace(
      /} catch \(err\) \{\r?\n(\s*)const e = err as/g,
      "} catch (err) {\n$1if (isZodError(err)) {\n$1  const zod = zodErrorBody(err);\n$1  return NextResponse.json(zod.body, { status: zod.status });\n$1}\n$1const e = err as",
    );
  }

  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("updated:", file);
  }
}

console.log("Total updated:", changed);
