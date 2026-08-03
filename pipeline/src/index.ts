import "dotenv/config";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import {
  loadCardLocalization,
  loadBookLocalization,
  loadNameMap,
} from "./localization.js";
import { parseCardFile } from "./parseCards.js";
import { parseKeyPageFile } from "./parseKeyPages.js";
import { parseEnemyFile } from "./parseEnemies.js";
import { parseDeckFile } from "./parseDecks.js";
import { loadPassiveDescriptions, parsePassiveFile } from "./parsePassives.js";
import { parseStageFile } from "./parseStages.js";
import { parseStoryFile } from "./parseStory.js";
import { parseAbnormalityCodexFile } from "./parseAbnormalityCodex.js";
import { buildArtIndex, resolveArtPath } from "./resolveArt.js";
import { listFilesByPrefix } from "./discoverFiles.js";
import { pickBestLocalizationFile } from "./resolveLocalization.js";
import { readXml, toArray } from "./xml.js";
import type { Card } from "./types.js";

function extractCardIds(filePath: string): string[] {
  const doc = readXml(filePath);
  return toArray<any>(doc.DiceCardXmlRoot?.Card).map((c) => String(c["@_ID"]));
}

function main(): void {
  const config = loadConfig();
  const outDir = path.resolve("data");
  const artOutDir = path.join(outDir, "art");
  mkdirSync(artOutDir, { recursive: true });

  const en = (name: string) => path.join(config.textRoot, "English", name);
  const kr = (name: string) => path.join(config.textRoot, name);
  const englishDir = path.join(config.textRoot, "English");

  // --- Cards: discover every CardInfo_* structural file, resolve its correct
  // localization file by real ID overlap (not filename guessing — verified during
  // design that filenames like "FinalBand" vs "BandFinal" don't line up), then parse. ---
  const cardStructuralFiles = [
    ...listFilesByPrefix(config.textRoot, "CardInfo_"),
    ...listFilesByPrefix(config.textRoot, "CardInfoJan"),
  ];
  const battleCardsCandidates = listFilesByPrefix(englishDir, "EN_BattleCards");
  const cardLocalizationCache = new Map<string, Map<string, string>>();

  let cards: Card[] = [];
  for (const structuralFile of cardStructuralFiles) {
    const ids = extractCardIds(structuralFile);
    const bestFile = pickBestLocalizationFile(ids, battleCardsCandidates);
    if (bestFile === null) {
      console.warn(
        `[cards] No confident localization match for ${structuralFile}; falling back to EN_BattleCards.txt`
      );
    }
    const localizationFile = bestFile ?? en("EN_BattleCards.txt");

    if (!cardLocalizationCache.has(localizationFile)) {
      cardLocalizationCache.set(localizationFile, loadCardLocalization(localizationFile));
    }
    const localization = cardLocalizationCache.get(localizationFile)!;

    cards = cards.concat(parseCardFile(structuralFile, localization));
  }

  // --- Key pages: every EquipPage_* file joins the single EN_Books.txt (verified —
  // there is only one localization file for this whole family, unlike Cards). ---
  const bookLocalization = loadBookLocalization(en("EN_Books.txt"));
  const keyPageFiles = listFilesByPrefix(config.textRoot, "EquipPage_");
  let keyPages = keyPageFiles.flatMap((f) => parseKeyPageFile(f, bookLocalization));

  // --- Enemies: every EnemyUnitInfo_* file, name resolved via character/creature name maps. ---
  const characterNames = loadNameMap(en("EN_CharactersName.txt"));
  const creatureNames = loadNameMap(en("EN_CreatureName.txt"));
  const enemyNames = new Map([...characterNames, ...creatureNames]);
  const enemyFiles = listFilesByPrefix(config.textRoot, "EnemyUnitInfo");
  let enemies = enemyFiles.flatMap((f) => parseEnemyFile(f, enemyNames));

  // --- Decks: every Deck_* file. ---
  const deckFiles = listFilesByPrefix(config.textRoot, "Deck_");
  const decks = new Map<string, string[]>();
  for (const f of deckFiles) {
    for (const [id, cardIds] of parseDeckFile(f)) {
      decks.set(id, cardIds);
    }
  }

  // Resolve Enemy.deckId -> actual card ID list, now that decks are parsed.
  const enemiesWithDecks = enemies.map((enemy) => ({
    ...enemy,
    deckCardIds: decks.get(enemy.deckId) ?? [],
  }));

  // --- Passives: every PassiveList* file, localization resolved per-file the same way
  // as Cards (ch7 boss passives split across per-boss EN_PassiveDesc_Ch7_*.txt files). ---
  const passiveDescCandidates = [
    ...listFilesByPrefix(englishDir, "EN_PassiveDesc"),
    ...listFilesByPrefix(englishDir, "EN_CreaturePassive"),
  ];
  const passiveStructuralFiles = listFilesByPrefix(config.textRoot, "PassiveList");
  const passiveDescCache = new Map<string, ReturnType<typeof loadPassiveDescriptions>>();

  let passives: ReturnType<typeof parsePassiveFile> = [];
  for (const structuralFile of passiveStructuralFiles) {
    const doc = readXml(structuralFile);
    const ids = toArray<any>(doc.PassiveXmlRoot?.Passive).map((p) => String(p["@_ID"]));
    const bestFile = pickBestLocalizationFile(ids, passiveDescCandidates);
    if (bestFile === null) {
      console.warn(
        `[passives] No confident localization match for ${structuralFile}; falling back to EN_PassiveDesc.txt`
      );
    }
    const localizationFile = bestFile ?? en("EN_PassiveDesc.txt");

    if (!passiveDescCache.has(localizationFile)) {
      passiveDescCache.set(localizationFile, loadPassiveDescriptions(localizationFile));
    }
    const descriptions = passiveDescCache.get(localizationFile)!;

    passives = passives.concat(parsePassiveFile(structuralFile, descriptions));
  }

  // --- Stages: every StageInfo* file. ---
  const stageFiles = listFilesByPrefix(config.textRoot, "StageInfo");
  const stages = stageFiles.flatMap((f) => parseStageFile(f));

  // --- Story: every EN_Chapter* file (self-contained, no join needed). ---
  const storyFiles = listFilesByPrefix(englishDir, "EN_Chapter");
  const story = storyFiles.flatMap((f) => parseStoryFile(f));

  // --- Abnormality codex: single file. ---
  const abnormalityCodex = parseAbnormalityCodexFile(en("EN_AbnormalityCards.txt"));

  // --- Art resolution (unchanged approach, now applied to every card). ---
  const artIndex = buildArtIndex(config.artRoots);
  for (const card of cards) {
    const source = resolveArtPath(artIndex, card.artwork);
    if (source) {
      const destName = `${card.id}${path.extname(source)}`;
      copyFileSync(source, path.join(artOutDir, destName));
      card.artworkPath = `art/${destName}`;
    }
  }

  writeFileSync(path.join(outDir, "cards.json"), JSON.stringify(cards, null, 2));
  writeFileSync(path.join(outDir, "keypages.json"), JSON.stringify(keyPages, null, 2));
  writeFileSync(
    path.join(outDir, "enemies.json"),
    JSON.stringify(enemiesWithDecks, null, 2)
  );
  writeFileSync(path.join(outDir, "passives.json"), JSON.stringify(passives, null, 2));
  writeFileSync(path.join(outDir, "stages.json"), JSON.stringify(stages, null, 2));
  writeFileSync(path.join(outDir, "story.json"), JSON.stringify(story, null, 2));
  writeFileSync(
    path.join(outDir, "abnormalityCodex.json"),
    JSON.stringify(abnormalityCodex, null, 2)
  );

  console.log(
    `Wrote ${cards.length} cards, ${keyPages.length} key pages, ${enemiesWithDecks.length} enemies, ` +
      `${passives.length} passives, ${stages.length} stages, ${story.length} story lines, ` +
      `${abnormalityCodex.length} abnormality codex entries to ${outDir}`
  );
}

main();
