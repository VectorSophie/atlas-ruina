import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildArtIndex, resolveArtPath } from "../src/resolveArt.js";

let root1: string;
let root2: string;

beforeAll(() => {
  root1 = mkdtempSync(path.join(tmpdir(), "lor-art-1-"));
  root2 = mkdtempSync(path.join(tmpdir(), "lor-art-2-"));
  writeFileSync(path.join(root1, "ch1_1.png"), "fake-png-bytes");
  writeFileSync(path.join(root2, "ch1_2.png"), "fake-png-bytes");
});

afterAll(() => {
  rmSync(root1, { recursive: true, force: true });
  rmSync(root2, { recursive: true, force: true });
});

describe("buildArtIndex / resolveArtPath", () => {
  it("finds a file by its name (without extension) across multiple roots", () => {
    const index = buildArtIndex([root1, root2]);
    expect(resolveArtPath(index, "ch1_1")).toBe(path.join(root1, "ch1_1.png"));
    expect(resolveArtPath(index, "ch1_2")).toBe(path.join(root2, "ch1_2.png"));
  });

  it("returns null when no matching file exists", () => {
    const index = buildArtIndex([root1, root2]);
    expect(resolveArtPath(index, "does_not_exist")).toBeNull();
  });
});
