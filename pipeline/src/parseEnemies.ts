import { readXml, toArray } from "./xml.js";
import type { Enemy } from "./types.js";

export function parseEnemyFile(filePath: string, names: Map<string, string>): Enemy[] {
  const doc = readXml(filePath);
  const enemyNodes = toArray<any>(doc.EnemyUnitClassRoot?.Enemy);

  return enemyNodes.map((node): Enemy => {
    const nameId = String(node.NameID ?? "");
    const name = names.get(nameId) ?? `Unknown (NameID ${nameId})`;

    return {
      id: String(node["@_ID"]),
      name,
      bookId: String(node.BookId ?? ""),
      deckId: String(node.DeckId ?? ""),
      minHeight: Number(node.MinHeight ?? 0),
      maxHeight: Number(node.MaxHeight ?? 0),
      exp: Number(node.Exp ?? 0),
    };
  });
}
