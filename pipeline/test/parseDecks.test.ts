import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeckFile } from "../src/parseDecks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "fixtures");

describe("parseDeckFile", () => {
  it("parses decks into a map from deck ID to its list of card IDs, duplicates preserved", () => {
    const decks = parseDeckFile(path.join(fixtures, "Deck_sample.txt"));

    expect(decks.get("101001")).toEqual(["102006", "102006", "100001", "100002"]);
    expect(decks.get("101002")).toEqual(["100003"]);
    expect(decks.size).toBe(2);
  });
});
