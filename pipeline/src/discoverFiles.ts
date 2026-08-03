import { readdirSync } from "node:fs";
import path from "node:path";

export function listFilesByPrefix(dir: string, prefix: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort()
    .map((name) => path.join(dir, name));
}
