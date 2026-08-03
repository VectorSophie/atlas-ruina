import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardsFrom, diceRange, detailIconName } from "../src/lib/cards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, "fixtures", "cards_sample.json");

describe("loadCardsFrom", () => {
  it("loads and parses cards from a JSON file", () => {
    const cards = loadCardsFrom(fixture);
    expect(cards).toHaveLength(2);
    expect(cards[0].name).toBe("Dodge and Strike");
    expect(cards[1].artworkPath).toBe("art/102003.png");
  });
});

describe("diceRange", () => {
  it("computes the [min, max] range for a behaviour from its min and die size", () => {
    expect(diceRange({ min: 1, dice: 4, type: "Def", detail: "Evasion", motion: "E" })).toEqual([
      1, 4,
    ]);
    expect(diceRange({ min: 3, dice: 6, type: "Atk", detail: "Penetrate", motion: "Z" })).toEqual(
      [3, 8]
    );
  });
});

describe("detailIconName", () => {
  it("maps a behaviour's detail to its icon sprite name, verbatim for most types", () => {
    for (const detail of ["Guard", "Hit", "Penetrate", "Slash"]) {
      expect(
        detailIconName({ min: 1, dice: 4, type: "Atk", detail, motion: "Z" })
      ).toBe(`BehaviourDetail_${detail}`);
    }
  });

  it("maps 'Evasion' to the 'Evade' sprite, the one real naming mismatch between the game's data field and its sprite file name", () => {
    expect(
      detailIconName({ min: 1, dice: 4, type: "Def", detail: "Evasion", motion: "E" })
    ).toBe("BehaviourDetail_Evade");
  });

  it("returns null for an empty/unknown detail rather than guessing at a sprite name", () => {
    expect(
      detailIconName({ min: 4, dice: 7, type: "Atk", detail: "", motion: "S2" })
    ).toBeNull();
  });
});
