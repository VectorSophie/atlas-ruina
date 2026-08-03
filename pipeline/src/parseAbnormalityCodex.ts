import { readXml, toArray } from "./xml.js";

export interface AbnormalityCodexEntry {
  id: string;
  sephirahType: string;
  abnormality: string;
  cardName: string;
  abilityDesc: string;
  flavorText: string;
  dialogues: string[];
}

export function parseAbnormalityCodexFile(filePath: string): AbnormalityCodexEntry[] {
  const doc = readXml(filePath);
  const sephirahNodes = toArray<any>(doc.AbnormalityCardsRoot?.Sephirah);

  const entries: AbnormalityCodexEntry[] = [];

  for (const sephirah of sephirahNodes) {
    const sephirahType = String(sephirah["@_SephirahType"] ?? "");
    const cardNodes = toArray<any>(sephirah.AbnormalityCard);

    for (const card of cardNodes) {
      const dialogueNodes = toArray<any>(card.Dialogues?.Dialogue).map((d) =>
        typeof d === "string" ? d : String(d?.["#text"] ?? "")
      );

      entries.push({
        id: String(card["@_ID"]),
        sephirahType,
        abnormality: String(card.Abnormality ?? ""),
        cardName: String(card.CardName ?? ""),
        abilityDesc: String(card.AbilityDesc ?? ""),
        flavorText: String(card.FlaborText ?? ""),
        dialogues: dialogueNodes,
      });
    }
  }

  return entries;
}
