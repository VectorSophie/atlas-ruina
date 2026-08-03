import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickBestLocalizationFile } from "../src/resolveLocalization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures", "localization-candidates");

describe("pickBestLocalizationFile", () => {
  it("picks the candidate with the highest real ID overlap, not just any match", () => {
    const structuralIds = ["1", "500001", "500002"];
    const candidates = [
      path.join(fixtures, "EN_Wrong.txt"),
      path.join(fixtures, "EN_Right.txt"),
    ];

    const result = pickBestLocalizationFile(structuralIds, candidates);

    expect(result).toBe(path.join(fixtures, "EN_Right.txt"));
  });

  it("returns null when no candidate has any overlap", () => {
    const structuralIds = ["999999"];
    const candidates = [path.join(fixtures, "EN_Wrong.txt")];

    const result = pickBestLocalizationFile(structuralIds, candidates);

    expect(result).toBeNull();
  });
});
