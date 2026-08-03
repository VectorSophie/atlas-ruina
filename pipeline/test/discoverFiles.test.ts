import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { listFilesByPrefix } from "../src/discoverFiles.js";

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "lor-discover-"));
  writeFileSync(path.join(root, "CardInfo_ch1.txt"), "");
  writeFileSync(path.join(root, "CardInfo_ch2.txt"), "");
  writeFileSync(path.join(root, "EquipPage_ch1.txt"), "");
  writeFileSync(path.join(root, "CardInfoJan.txt"), "");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("listFilesByPrefix", () => {
  it("returns full paths of files starting with the given prefix, sorted", () => {
    const result = listFilesByPrefix(root, "CardInfo");
    expect(result).toEqual([
      path.join(root, "CardInfoJan.txt"),
      path.join(root, "CardInfo_ch1.txt"),
      path.join(root, "CardInfo_ch2.txt"),
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(listFilesByPrefix(root, "NoSuchPrefix")).toEqual([]);
  });
});
