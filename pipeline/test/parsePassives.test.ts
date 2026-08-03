import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPassiveDescriptions, parsePassiveFile } from "../src/parsePassives.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parsePassiveFile", () => {
  it("parses passives and joins name/description by ID", () => {
    const descriptions = loadPassiveDescriptions(
      path.join(fixtures, "EN_PassiveDesc_sample.txt")
    );
    const passives = parsePassiveFile(
      path.join(fixtures, "PassiveList_sample.txt"),
      descriptions
    );

    expect(passives).toHaveLength(2);
    expect(passives[0]).toEqual({
      id: "1001011",
      name: "Scars",
      desc: "Take 1-5 less damage from Slash attacks.",
      level: 1,
      rarity: "Common",
    });
    expect(passives[1]).toEqual({
      id: "1001012",
      name: "Blood",
      desc: "Lose 3 Speed. Boost the max value of Block dice by +3.",
      level: 1,
      rarity: "",
    });
  });
});
