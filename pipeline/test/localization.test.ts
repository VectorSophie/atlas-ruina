import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCardLocalization,
  loadBookLocalization,
  loadNameMap,
} from "../src/localization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("loadCardLocalization", () => {
  it("maps card ID to its localized name", () => {
    const map = loadCardLocalization(path.join(fixtures, "EN_BattleCards_sample.txt"));
    expect(map.get("100001")).toBe("Flowing Strike");
    expect(map.get("100002")).toBe("Stab");
  });
});

describe("loadBookLocalization", () => {
  it("maps book ID to its name and paragraph list", () => {
    const map = loadBookLocalization(path.join(fixtures, "EN_Books_sample.txt"));
    const entry = map.get("200001");
    expect(entry?.name).toBe("Lenny's Page");
    expect(entry?.paragraphs).toEqual([
      "Wanna hear a secret?",
      "Back when I was a young kid, I didn't like that.",
    ]);
  });
});

describe("loadNameMap", () => {
  it("maps numeric character ID to its localized name", () => {
    const map = loadNameMap(path.join(fixtures, "EN_CharactersName_sample.txt"));
    expect(map.get("12")).toBe("Lenny");
    expect(map.get("13")).toBe("Pete");
  });
});
