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

export interface KeyPageDesc {
  paragraphs: string[];
}

export interface KeyPageEquipEffect {
  hp: number;
  breakStat: number;
  speedMin: number;
  speed: number;
  sResist: string;
  pResist: string;
  hResist: string;
}

export interface KeyPage {
  id: string;
  name: string;
  desc: KeyPageEquipEffect | null;
  paragraphs: string[];
  bookIcon: string;
  rarity: string;
  chapter: number;
  characterSkin: string;
}

export interface Enemy {
  id: string;
  name: string;
  bookId: string;
  deckId: string;
  minHeight: number;
  maxHeight: number;
  exp: number;
}
