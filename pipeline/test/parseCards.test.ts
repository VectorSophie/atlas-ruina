import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCardFile } from "../src/parseCards.js";
import { loadCardLocalization } from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseCardFile", () => {
  it("parses cards and prefers the localized English name", () => {
    const localization = loadCardLocalization(
      path.join(fixtures, "EN_BattleCards_sample.txt")
    );
    const cards = parseCardFile(path.join(fixtures, "CardInfo_sample.txt"), localization);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      id: "100001",
      name: "Flowing Strike",
      artwork: "ch1_1",
      artworkPath: null,
      rarity: "Common",
      range: "Near",
      cost: 0,
      chapter: 1,
      behaviours: [
        { min: 1, dice: 4, type: "Def", detail: "Evasion", motion: "E" },
        { min: 1, dice: 2, type: "Atk", detail: "Slash", motion: "H" },
      ],
    });
  });

  it("falls back to the raw Korean name when no localization entry exists", () => {
    const cards = parseCardFile(
      path.join(fixtures, "CardInfo_sample.txt"),
      new Map()
    );
    expect(cards[0].name).toBe("흘려치기");
  });
});
