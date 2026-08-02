import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseKeyPageFile } from "../src/parseKeyPages.js";
import { loadBookLocalization } from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseKeyPageFile", () => {
  it("parses stats and joins the English name/description", () => {
    const localization = loadBookLocalization(path.join(fixtures, "EN_Books_sample.txt"));
    const pages = parseKeyPageFile(path.join(fixtures, "EquipPage_sample.txt"), localization);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual({
      id: "200001",
      name: "Lenny's Page",
      desc: {
        hp: 42,
        breakStat: 22,
        speedMin: 1,
        speed: 4,
        sResist: "Normal",
        pResist: "Vulnerable",
        hResist: "Weak",
      },
      paragraphs: [
        "Wanna hear a secret?",
        "Back when I was a young kid, I didn't like that.",
      ],
      bookIcon: "Rats",
      rarity: "Common",
      chapter: 1,
      characterSkin: "Lenny",
    });
  });
});
