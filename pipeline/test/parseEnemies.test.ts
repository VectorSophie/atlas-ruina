import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnemyFile } from "../src/parseEnemies.js";
import { loadNameMap } from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseEnemyFile", () => {
  it("parses enemies and resolves their name via NameID", () => {
    const names = loadNameMap(path.join(fixtures, "EN_CharactersName_sample.txt"));
    const enemies = parseEnemyFile(
      path.join(fixtures, "EnemyUnitInfo_sample.txt"),
      names
    );

    expect(enemies).toHaveLength(2);
    expect(enemies[0]).toEqual({
      id: "1",
      name: "Lenny",
      bookId: "200001",
      deckId: "100001",
      minHeight: 165,
      maxHeight: 165,
      exp: 2,
    });
    expect(enemies[1].name).toBe("Pete");
  });

  it("falls back to a placeholder name when NameID has no match", () => {
    const enemies = parseEnemyFile(
      path.join(fixtures, "EnemyUnitInfo_sample.txt"),
      new Map()
    );
    expect(enemies[0].name).toBe("Unknown (NameID 12)");
  });
});
