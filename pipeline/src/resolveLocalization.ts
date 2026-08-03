import { readXml, toArray } from "./xml.js";

function extractCardDescIds(filePath: string): Set<string> {
  const doc = readXml(filePath);
  const entries = toArray<any>(doc.BattleCardDescRoot?.cardDescList?.BattleCardDesc);
  return new Set(entries.map((entry) => String(entry["@_ID"])));
}

export function pickBestLocalizationFile(
  structuralIds: string[],
  candidateFiles: string[]
): string | null {
  let bestFile: string | null = null;
  let bestCount = 0;

  for (const candidate of candidateFiles) {
    const candidateIds = extractCardDescIds(candidate);
    let count = 0;
    for (const id of structuralIds) {
      if (candidateIds.has(id)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestFile = candidate;
    }
  }

  return bestFile;
}
