import { readdirSync } from "node:fs";
import path from "node:path";

export type ArtIndex = Map<string, string>;

export function buildArtIndex(roots: string[]): ArtIndex {
  const index: ArtIndex = new Map();
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const stem = path.parse(entry).name;
      if (!index.has(stem)) {
        index.set(stem, path.join(root, entry));
      }
    }
  }
  return index;
}

export function resolveArtPath(index: ArtIndex, assetName: string): string | null {
  return index.get(assetName) ?? null;
}
