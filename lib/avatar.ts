import { promises as fs } from "fs";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "profiles");
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export async function getAvatarUrl(userId: number): Promise<string | null> {
  try {
    const files = await fs.readdir(AVATAR_DIR);
    const matches = files.filter((f) => f.startsWith(`avatar-${userId}-`) || f.startsWith(`avatar-${userId}.`));
    if (!matches.length) return null;

    const withStats = await Promise.all(
      matches.map(async (name) => {
        const stat = await fs.stat(path.join(AVATAR_DIR, name));
        return { name, mtimeMs: stat.mtimeMs };
      }),
    );
    withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return `/uploads/profiles/${withStats[0].name}`;
  } catch {
    return null;
  }
}

export async function removeOldAvatars(userId: number) {
  try {
    const files = await fs.readdir(AVATAR_DIR);
    const targets = files.filter((f) => f.startsWith(`avatar-${userId}-`) || f.startsWith(`avatar-${userId}.`));
    await Promise.all(
      targets.map(async (name) => {
        try {
          await fs.unlink(path.join(AVATAR_DIR, name));
        } catch {
          // ignore per-file deletion errors
        }
      }),
    );
  } catch {
    // ignore when directory doesn't exist yet
  }
}

export async function saveAvatarFile(userId: number, bytes: ArrayBuffer, mimeType: string) {
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "bin";
  if (!ALLOWED_EXTENSIONS.includes(ext)) throw new Error("Unsupported avatar extension");

  await fs.mkdir(AVATAR_DIR, { recursive: true });
  await removeOldAvatars(userId);
  const fileName = `avatar-${userId}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(AVATAR_DIR, fileName), Buffer.from(bytes));
  return `/uploads/profiles/${fileName}`;
}

