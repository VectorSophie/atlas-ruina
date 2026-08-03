import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAbnormalityCodexFile } from "../src/parseAbnormalityCodex.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseAbnormalityCodexFile", () => {
  it("parses abnormality codex entries with their dialogue lines", () => {
    const entries = parseAbnormalityCodexFile(
      path.join(fixtures, "EN_AbnormalityCards_sample.txt")
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: "ScorchedGirl_Walk",
      sephirahType: "Malkuth",
      abnormality: "Scorched Girl",
      cardName: "Footfalls",
      abilityDesc:
        "[All Allies]\nWhen a librarian's HP is at 20% or lower, deal 30% of the target's Max HP as damage.",
      flavorText: "I am coming to you. You, who will be reduced to ash like me.",
      dialogues: [
        "If I must perish, then join me.",
        "It's just too sad to die alone...",
      ],
    });
  });
});
