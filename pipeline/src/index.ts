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
import {
  loadPassiveDescriptions,
  parsePassiveFile,
  type Passive,
  type PassiveDescription,
} from "./parsePassives.js";
import { parseStageFile } from "./parseStages.js";
import { parseStoryFile } from "./parseStory.js";
import { parseAbnormalityCodexFile } from "./parseAbnormalityCodex.js";
import { buildArtIndex, resolveArtPath } from "./resolveArt.js";
import { listFilesByPrefix } from "./discoverFiles.js";
import { pickBestLocalizationFile } from "./resolveLocalization.js";
import { readXml, toArray } from "./xml.js";
import { dedupeById } from "./dedupe.js";
import type { Card, EnemyWithDeck } from "./types.js";

function extractCardIds(filePath: string): string[] {
  const doc = readXml(filePath);
  return toArray<any>(doc.DiceCardXmlRoot?.Card).map((c) => String(c["@_ID"]));
}

function extractPassiveIds(filePath: string): string[] {
  const doc = readXml(filePath);
  return toArray<any>(doc.PassiveXmlRoot?.Passive).map((p) => String(p["@_ID"]));
}

// Shared by the Card and Passive resolution loops below: both need to discover the
// correct localization file per structural file via real ID overlap (not filename
// guessing), warn when the resolver has no confident match, cache the loaded
// localization per resolved file path, and parse. Kept generic over both the
// localization value type (L) and the parsed record type (T) so it can serve
// Card (string) and Passive (PassiveDescription) alike.
function resolveAndParse<T, L>(
  structuralFiles: string[],
  candidateFiles: string[],
  extractIds: (filePath: string) => string[],
  fallbackFile: string,
  cache: Map<string, Map<string, L>>,
  loadLocalization: (filePath: string) => Map<string, L>,
  parseFile: (filePath: string, localization: Map<string, L>) => T[],
  warnLabel: string
): T[] {
  return structuralFiles.flatMap((structuralFile) => {
    const ids = extractIds(structuralFile);
    const bestFile = pickBestLocalizationFile(ids, candidateFiles);
    if (bestFile === null) {
      console.warn(
        `[${warnLabel}] No confident localization match for ${structuralFile}; falling back to ${fallbackFile}`
      );
    }
    const localizationFile = bestFile ?? fallbackFile;

    if (!cache.has(localizationFile)) {
      cache.set(localizationFile, loadLocalization(localizationFile));
    }
    const localization = cache.get(localizationFile)!;

    return parseFile(structuralFile, localization);
  });
}

function main(): void {
  const config = loadConfig();
  const outDir = path.resolve("data");
  const artOutDir = path.join(outDir, "art");
  mkdirSync(artOutDir, { recursive: true });

  const en = (name: string) => path.join(config.textRoot, "English", name);
  const englishDir = path.join(config.textRoot, "English");

  // --- Cards: discover every CardInfo_* structural file, resolve its correct
  // localization file by real ID overlap (not filename guessing — verified during
  // design that filenames like "FinalBand" vs "BandFinal" don't line up), then parse.
  // CardInfoJan.txt is deliberately excluded: verified it's leftover dev-prototype data
  // (a different, older XML schema using Level/Rwbp instead of Min, with literal
  // placeholder card names like "Wanna test something?") that both corrupts its own
  // records (Min doesn't exist in that schema, producing null/undefined fields) and
  // collides with 6 real chapter-1 card IDs, silently overwriting them at build time. ---
  const cardStructuralFiles = listFilesByPrefix(config.textRoot, "CardInfo_");
  const battleCardsCandidates = listFilesByPrefix(englishDir, "EN_BattleCards");
  const cardLocalizationCache = new Map<string, Map<string, string>>();

  const rawCards: Card[] = resolveAndParse<Card, string>(
    cardStructuralFiles,
    battleCardsCandidates,
    extractCardIds,
    en("EN_BattleCards.txt"),
    cardLocalizationCache,
    loadCardLocalization,
    parseCardFile,
    "cards"
  );
  // Some cards are legitimately defined in more than one source file with identical
  // content (e.g. a chapter-7 card also appearing in its boss's alternate-phase file) —
  // dedupe by id so every card is reachable at its own detail page, warning if two
  // records for the same id ever differ (which would mean a real data conflict, not a
  // harmless re-definition).
  const cards = dedupeById(rawCards, "cards");

  // --- Key pages: every EquipPage_* file joins the single EN_Books.txt (verified —
  // there is only one localization file for this whole family, unlike Cards). ---
  const bookLocalization = loadBookLocalization(en("EN_Books.txt"));
  const keyPageFiles = listFilesByPrefix(config.textRoot, "EquipPage_");
  const keyPages = keyPageFiles.flatMap((f) => parseKeyPageFile(f, bookLocalization));

  // --- Enemies: every EnemyUnitInfo_* file, name resolved via character/creature name maps. ---
  const characterNames = loadNameMap(en("EN_CharactersName.txt"));
  const creatureNames = loadNameMap(en("EN_CreatureName.txt"));
  const enemyNames = new Map([...characterNames, ...creatureNames]);
  const enemyFiles = listFilesByPrefix(config.textRoot, "EnemyUnitInfo");
  const enemies = enemyFiles.flatMap((f) => parseEnemyFile(f, enemyNames));

  // --- Decks: every Deck_* file. ---
  const deckFiles = listFilesByPrefix(config.textRoot, "Deck_");
  const decks = new Map<string, string[]>();
  for (const f of deckFiles) {
    for (const [id, cardIds] of parseDeckFile(f)) {
      decks.set(id, cardIds);
    }
  }

  // Resolve Enemy.deckId -> actual card ID list, now that decks are parsed.
  const rawEnemiesWithDecks: EnemyWithDeck[] = enemies.map((enemy) => ({
    ...enemy,
    deckCardIds: decks.get(enemy.deckId) ?? [],
  }));
  // Dedupe by id: some enemies (e.g. seasonal event units) are defined identically
  // across multiple EnemyUnitInfo_* files.
  const enemiesWithDecks = dedupeById(rawEnemiesWithDecks, "enemies");

  // --- Passives: every PassiveList* file, localization resolved per-file the same way
  // as Cards (ch7 boss passives split across per-boss EN_PassiveDesc_Ch7_*.txt files). ---
  const passiveDescCandidates = [
    ...listFilesByPrefix(englishDir, "EN_PassiveDesc"),
    ...listFilesByPrefix(englishDir, "EN_CreaturePassive"),
  ];
  const passiveStructuralFiles = listFilesByPrefix(config.textRoot, "PassiveList");
  const passiveDescCache = new Map<string, Map<string, PassiveDescription>>();

  const passives: Passive[] = resolveAndParse<Passive, PassiveDescription>(
    passiveStructuralFiles,
    passiveDescCandidates,
    extractPassiveIds,
    en("EN_PassiveDesc.txt"),
    passiveDescCache,
    loadPassiveDescriptions,
    parsePassiveFile,
    "passives"
  );

  // --- Stages: every StageInfo* file. Dedupe by id: verified one real collision
  // (id 202004 in StageInfo_creature.txt) where a stray, incomplete duplicate stage
  // entry was mislabeled with an id belonging to an earlier, legitimate stage in the
  // same file -- "keep first occurrence" was manually confirmed correct for this
  // case (the real stage that id belongs to already exists separately at 203004).
  // dedupeById logs a warning if a future differing-content collision appears, since
  // "keep first" is not a principled rule for which record is correct -- it should
  // be manually re-verified the same way if that warning ever fires again. ---
  const stageFiles = listFilesByPrefix(config.textRoot, "StageInfo");
  const rawStages = stageFiles.flatMap((f) => parseStageFile(f));
  const stages = dedupeById(rawStages, "stages");

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
