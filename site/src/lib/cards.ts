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

// Every real behaviour.detail value ("Guard", "Hit", "Penetrate", "Slash", "Evasion") has a
// matching BehaviourDetail_*.png sprite in the extracted asset dump, confirmed against the
// real card data (100% coverage, unlike per-die-size sprites which only exist for 5 of the
// many real dice values). "Evasion" is the one field-name-vs-sprite-name mismatch: the sprite
// is "BehaviourDetail_Evade.png", not "..._Evasion.png". A small number of real behaviours
// (chapter 7 boss cards) have an empty detail due to a source-data gap — detailIconName()
// returns null for those rather than guessing at a sprite name that doesn't exist.
const DETAIL_ICON_OVERRIDES: Record<string, string> = {
  Evasion: "Evade",
};

export function detailIconName(behaviour: CardBehaviour): string | null {
  if (!behaviour.detail) return null;
  const spriteDetail = DETAIL_ICON_OVERRIDES[behaviour.detail] ?? behaviour.detail;
  return `BehaviourDetail_${spriteDetail}`;
}
