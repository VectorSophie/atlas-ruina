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

// Only these die face-counts have a matching Dice_{n}.png sprite in the extracted asset
// dump (verified during design). Real behaviour.dice values range 1-30+, so most behaviours
// have no matching sprite — hasDieSprite() lets consumers fall back to text-only display
// instead of referencing a nonexistent image.
const KNOWN_DICE_SIZES = new Set([4, 6, 8, 12, 20]);

export function hasDieSprite(behaviour: CardBehaviour): boolean {
  return KNOWN_DICE_SIZES.has(behaviour.dice);
}
