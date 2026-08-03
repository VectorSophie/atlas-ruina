import { readXml, toArray } from "./xml.js";

// Localization candidate files come in more than one XML shape depending on which
// structural family they describe (Cards: BattleCardDescRoot > cardDescList >
// BattleCardDesc; Passives: PassiveDescRoot > PassiveDesc directly). Try each known
// shape rather than hardcoding one, so this resolver stays reusable across families.
function extractCandidateIds(filePath: string): Set<string> {
  const doc = readXml(filePath);
  const entries = [
    ...toArray<any>(doc.BattleCardDescRoot?.cardDescList?.BattleCardDesc),
    ...toArray<any>(doc.PassiveDescRoot?.PassiveDesc),
  ];
  return new Set(entries.map((entry) => String(entry["@_ID"])));
}

export function pickBestLocalizationFile(
  structuralIds: string[],
  candidateFiles: string[]
): string | null {
  let bestFile: string | null = null;
  let bestCount = 0;

  for (const candidate of candidateFiles) {
    const candidateIds = extractCandidateIds(candidate);
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
