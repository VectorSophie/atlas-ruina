import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readXml, toArray } from "../src/xml.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, "fixtures", "CardInfo_sample.txt");

describe("readXml", () => {
  it("parses an XML file into a JS object with attribute access", () => {
    const doc = readXml(fixture);
    const cards = toArray(doc.DiceCardXmlRoot.Card);
    expect(cards).toHaveLength(2);
    expect(cards[0]["@_ID"]).toBe("100001");
    expect(cards[0].Name).toBe("흘려치기");
  });
});

describe("toArray", () => {
  it("wraps a single object in an array", () => {
    expect(toArray({ a: 1 })).toEqual([{ a: 1 }]);
  });

  it("passes an existing array through unchanged", () => {
    expect(toArray([{ a: 1 }, { a: 2 }])).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("returns an empty array for undefined", () => {
    expect(toArray(undefined)).toEqual([]);
  });
});
