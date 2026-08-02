import { readXml, toArray } from "./xml.js";
import type { KeyPage } from "./types.js";
import type { BookLocalization } from "./localization.js";

export function parseKeyPageFile(
  filePath: string,
  localization: Map<string, BookLocalization>
): KeyPage[] {
  const doc = readXml(filePath);
  const bookNodes = toArray<any>(doc.BookXmlRoot?.Book);

  return bookNodes.map((node): KeyPage => {
    const id = String(node["@_ID"]);
    const loc = localization.get(id);
    const effect = node.EquipEffect ?? {};

    return {
      id,
      name: loc?.name || String(node.Name ?? ""),
      desc: {
        hp: Number(effect.HP ?? 0),
        breakStat: Number(effect.Break ?? 0),
        speedMin: Number(effect.SpeedMin ?? 0),
        speed: Number(effect.Speed ?? 0),
        sResist: String(effect.SResist ?? ""),
        pResist: String(effect.PResist ?? ""),
        hResist: String(effect.HResist ?? ""),
      },
      paragraphs: loc?.paragraphs ?? [],
      bookIcon: String(node.BookIcon ?? ""),
      rarity: String(node.Rarity ?? ""),
      chapter: Number(node.Chapter ?? 0),
      characterSkin: String(node.CharacterSkin ?? ""),
    };
  });
}
