import { readXml, toArray } from "./xml.js";

// Returns a Map (not an array like parseCardFile/parseKeyPageFile/parseEnemyFile) because
// decks are only ever consumed as a lookup by Enemy.deckId, never iterated as top-level
// records — matching loadNameMap/loadCardLocalization's lookup-table convention.
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
