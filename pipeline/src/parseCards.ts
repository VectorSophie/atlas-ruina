import { readXml, toArray } from "./xml.js";
import type { Card, CardBehaviour } from "./types.js";

export function parseCardFile(filePath: string, localization: Map<string, string>): Card[] {
  const doc = readXml(filePath);
  const cardNodes = toArray<any>(doc.DiceCardXmlRoot?.Card);

  return cardNodes.map((node): Card => {
    const id = String(node["@_ID"]);
    const behaviourNodes = toArray<any>(node.BehaviourList?.Behaviour);
    const behaviours: CardBehaviour[] = behaviourNodes.map((b) => ({
      min: Number(b["@_Min"]),
      dice: Number(b["@_Dice"]),
      type: String(b["@_Type"]),
      detail: String(b["@_Detail"]),
      motion: String(b["@_Motion"]),
    }));

    return {
      id,
      name: localization.get(id) || String(node.Name ?? ""),
      artwork: String(node.Artwork ?? ""),
      artworkPath: null,
      rarity: String(node.Rarity ?? ""),
      range: String(node.Spec?.["@_Range"] ?? ""),
      cost: Number(node.Spec?.["@_Cost"] ?? 0),
      chapter: Number(node.Chapter ?? 0),
      behaviours,
    };
  });
}
