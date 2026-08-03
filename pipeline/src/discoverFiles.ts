import { readdirSync } from "node:fs";
import path from "node:path";

export function listFilesByPrefix(dir: string, prefix: string): string[] {
  return readdirSync(dir)
    .filter((entry) => entry.startsWith(prefix))
    .sort()
    .map((entry) => path.join(dir, entry));
}
