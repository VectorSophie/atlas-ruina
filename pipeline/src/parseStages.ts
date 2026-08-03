import { readXml, toArray } from "./xml.js";

export interface Stage {
  id: string;
  name: string;
  enemyIds: string[];
  formation: string;
  floorNum: number;
  chapter: number;
  storyType: string;
  storyStart: string;
  storyEnd: string;
}

export function parseStageFile(filePath: string): Stage[] {
  const doc = readXml(filePath);
  const nodes = toArray<any>(doc.StageXmlRoot?.Stage);

  return nodes.map((node): Stage => {
    const storyNodes = toArray<any>(node.Story);
    const storyStart = storyNodes.find((s) => s["@_Condition"] === "Start");
    const storyEnd = storyNodes.find((s) => s["@_Condition"] === "End");

    return {
      id: String(node["@_id"]),
      name: String(node.Name ?? ""),
      enemyIds: toArray<string | number>(node.Wave?.Unit).map((u) => String(u)),
      formation: String(node.Wave?.Formation ?? ""),
      floorNum: Number(node.FloorNum ?? 0),
      chapter: Number(node.Chapter ?? 0),
      storyType: String(node.StoryType ?? ""),
      storyStart: typeof storyStart === "object" ? String(storyStart["#text"] ?? "") : "",
      storyEnd: typeof storyEnd === "object" ? String(storyEnd["#text"] ?? "") : "",
    };
  });
}
