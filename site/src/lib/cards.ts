import { readFileSync } from "node:fs";
import path from "node:path";

export interface CardBehaviour {
  min: number;
  dice: number;
  type: string;
  detail: string;
  motion: string;
}

export interface Card {
  id: string;
  name: string;
  artwork: string;
  artworkPath: string | null;
  rarity: string;
  range: string;
  cost: number;
  chapter: number;
  behaviours: CardBehaviour[];
}

export function loadCardsFrom(filePath: string): Card[] {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Card[];
}

export function loadCards(): Card[] {
  const filePath = path.resolve(process.cwd(), "../pipeline/data/cards.json");
  return loadCardsFrom(filePath);
}

export function diceRange(behaviour: CardBehaviour): [number, number] {
  return [behaviour.min, behaviour.min + behaviour.dice - 1];
}
