import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function readXml(filePath: string): any {
  const raw = readFileSync(filePath, "utf-8");
  return parser.parse(raw);
}

export function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
