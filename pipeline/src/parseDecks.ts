import { readXml, toArray } from "./xml.js";

export function parseDeckFile(filePath: string): Map<string, string[]> {
  const doc = readXml(filePath);
  const deckNodes = toArray<any>(doc.DeckXmlRoot?.Deck);
  const decks = new Map<string, string[]>();

  for (const node of deckNodes) {
    const id = String(node["@_ID"]);
    const cardIds = toArray<string | number>(node.Card).map((c) => String(c));
    decks.set(id, cardIds);
  }

  return decks;
}
