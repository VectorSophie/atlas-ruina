import { readXml, toArray } from "./xml.js";

export interface PassiveDescription {
  name: string;
  desc: string;
}

export interface Passive {
  id: string;
  name: string;
  desc: string;
  level: number;
  rarity: string;
}

export function loadPassiveDescriptions(filePath: string): Map<string, PassiveDescription> {
  const doc = readXml(filePath);
  const entries = toArray<any>(doc.PassiveDescRoot?.PassiveDesc);
  const map = new Map<string, PassiveDescription>();

  for (const entry of entries) {
    const id = String(entry["@_ID"]);
    map.set(id, {
      name: typeof entry.Name === "string" ? entry.Name : "",
      desc: typeof entry.Desc === "string" ? entry.Desc : "",
    });
  }

  return map;
}

export function parsePassiveFile(
  filePath: string,
  descriptions: Map<string, PassiveDescription>
): Passive[] {
  const doc = readXml(filePath);
  const nodes = toArray<any>(doc.PassiveXmlRoot?.Passive);

  return nodes.map((node): Passive => {
    const id = String(node["@_ID"]);
    const desc = descriptions.get(id);

    return {
      id,
      name: desc?.name ?? "",
      desc: desc?.desc ?? "",
      level: Number(node.Level ?? 0),
      rarity: String(node.Rarity ?? ""),
    };
  });
}
