import { readXml, toArray } from "./xml.js";

export function loadCardLocalization(filePath: string): Map<string, string> {
  const doc = readXml(filePath);
  const entries = toArray(doc.BattleCardDescRoot?.cardDescList?.BattleCardDesc);
  const map = new Map<string, string>();
  for (const entry of entries) {
    const id = String(entry["@_ID"]);
    const name = typeof entry.LocalizedName === "string" ? entry.LocalizedName : "";
    map.set(id, name);
  }
  return map;
}

export interface BookLocalization {
  name: string;
  paragraphs: string[];
}

export function loadBookLocalization(filePath: string): Map<string, BookLocalization> {
  const doc = readXml(filePath);
  const entries = toArray(doc.BookDescRoot?.bookDescList?.BookDesc);
  const map = new Map<string, BookLocalization>();
  for (const entry of entries) {
    const id = String(entry["@_BookID"]);
    const name = typeof entry.BookName === "string" ? entry.BookName : "";
    const paragraphs = toArray<string>(entry.TextList?.Desc).filter(
      (p): p is string => typeof p === "string"
    );
    map.set(id, { name, paragraphs });
  }
  return map;
}

export function loadNameMap(filePath: string): Map<string, string> {
  const doc = readXml(filePath);
  const entries = toArray(doc.CharactersNameRoot?.Name);
  const map = new Map<string, string>();
  for (const entry of entries) {
    const id = String(entry["@_ID"]);
    const name = typeof entry["#text"] === "string" ? entry["#text"] : String(entry ?? "");
    map.set(id, name);
  }
  return map;
}
